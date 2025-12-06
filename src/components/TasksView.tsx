// Tasks Section Component for Caretakers
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Pill, Clock, Bell, CheckCircle } from "lucide-react";

interface TasksViewProps {
    caretakerId: string;
}

interface MedicineReminder {
    id: string;
    medicineName: string;
    dosage: string;
    time: string;
    patientName: string;
    patientId: string;
    status: 'upcoming' | 'now' | 'past';
}

export default function TasksView({ caretakerId }: TasksViewProps) {
    const [todaysMedicines, setTodaysMedicines] = useState<MedicineReminder[]>([]);

    useEffect(() => {
        const q = query(
            collection(db, "medicines"),
            where("caretakerId", "==", caretakerId),
            where("active", "==", true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            const allReminders: MedicineReminder[] = [];

            snapshot.docs.forEach((doc) => {
                const medicine = doc.data();

                medicine.times.forEach((time: string) => {
                    let status: 'upcoming' | 'now' | 'past' = 'upcoming';

                    if (time < currentTime) {
                        status = 'past';
                    } else if (time === currentTime) {
                        status = 'now';
                    }

                    allReminders.push({
                        id: `${doc.id}-${time}`,
                        medicineName: medicine.name,
                        dosage: medicine.dosage,
                        time: time,
                        patientName: medicine.patientName || "Patient",
                        patientId: medicine.patientId,
                        status
                    });
                });
            });

            // Sort by time
            allReminders.sort((a, b) => a.time.localeCompare(b.time));
            setTodaysMedicines(allReminders);
        });

        // Update status every minute
        const interval = setInterval(() => {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            setTodaysMedicines(prev => prev.map(reminder => {
                let status: 'upcoming' | 'now' | 'past' = 'upcoming';

                if (reminder.time < currentTime) {
                    status = 'past';
                } else if (reminder.time === currentTime) {
                    status = 'now';
                }

                return { ...reminder, status };
            }));
        }, 60000);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, [caretakerId]);

    const upcomingCount = todaysMedicines.filter(m => m.status === 'upcoming' || m.status === 'now').length;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Daily Tasks</h1>
                <p className="text-gray-500">Manage your caretaker responsibilities</p>
            </div>

            {/* Summary Cards */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white p-4 rounded-xl shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm opacity-90">Today's Medicines</p>
                            <p className="text-3xl font-bold">{todaysMedicines.length}</p>
                        </div>
                        <Pill className="h-10 w-10 opacity-80" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-xl shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm opacity-90">Upcoming</p>
                            <p className="text-3xl font-bold">{upcomingCount}</p>
                        </div>
                        <Bell className="h-10 w-10 opacity-80" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white p-4 rounded-xl shadow-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm opacity-90">Completed</p>
                            <p className="text-3xl font-bold">{todaysMedicines.filter(m => m.status === 'past').length}</p>
                        </div>
                        <CheckCircle className="h-10 w-10 opacity-80" />
                    </div>
                </div>
            </div>

            {/* Medicine Schedule */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                    <Clock className="h-5 w-5 mr-2 text-blue-600" />
                    Today's Medicine Schedule
                </h2>

                {todaysMedicines.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <Pill className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No medicines scheduled for today</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {todaysMedicines.map((reminder) => (
                            <div
                                key={reminder.id}
                                className={`p-4 rounded-xl border-2 transition-all ${reminder.status === 'now'
                                        ? 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-300 shadow-lg'
                                        : reminder.status === 'upcoming'
                                            ? 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200'
                                            : 'bg-gray-50 border-gray-200 opacity-60'
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <Clock className={`h-4 w-4 ${reminder.status === 'now' ? 'text-orange-600' :
                                                    reminder.status === 'upcoming' ? 'text-purple-600' :
                                                        'text-gray-400'
                                                }`} />
                                            <span className={`font-bold text-lg ${reminder.status === 'now' ? 'text-orange-700' :
                                                    reminder.status === 'upcoming' ? 'text-purple-700' :
                                                        'text-gray-500'
                                                }`}>
                                                {reminder.time}
                                            </span>
                                            {reminder.status === 'now' && (
                                                <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse">
                                                    NOW
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-gray-900">{reminder.patientName}</h3>
                                        <p className="text-sm text-gray-700">
                                            💊 {reminder.medicineName} - {reminder.dosage}
                                        </p>
                                    </div>
                                    <div>
                                        {reminder.status === 'past' ? (
                                            <CheckCircle className="h-6 w-6 text-gray-400" />
                                        ) : (
                                            <Bell className={`h-6 w-6 ${reminder.status === 'now' ? 'text-orange-500 animate-pulse' : 'text-purple-500'
                                                }`} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
