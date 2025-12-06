// Patient Medicine Schedule View Component
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Pill, Clock, CheckCircle, XCircle } from "lucide-react";

interface PatientMedicineViewProps {
    patientId: string;
}

interface Medicine {
    id: string;
    name: string;
    dosage: string;
    times: string[];
    instructions: string;
}

export default function PatientMedicineView({ patientId }: PatientMedicineViewProps) {
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const q = query(
            collection(db, "medicines"),
            where("patientId", "==", patientId),
            where("active", "==", true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMedicines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Medicine)));
        });

        // Update current time every minute
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 60000);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, [patientId]);

    const getCurrentTimeString = () => {
        return `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
    };

    const isUpcoming = (time: string) => {
        const current = getCurrentTimeString();
        return time > current;
    };

    const isPast = (time: string) => {
        const current = getCurrentTimeString();
        return time < current;
    };

    // Get all medicine times for today
    const todaysSchedule = medicines.flatMap(medicine =>
        medicine.times.map(time => ({
            time,
            medicine: medicine.name,
            dosage: medicine.dosage,
            instructions: medicine.instructions,
            status: isPast(time) ? 'past' : isUpcoming(time) ? 'upcoming' : 'now'
        }))
    ).sort((a, b) => a.time.localeCompare(b.time));

    if (medicines.length === 0) {
        return (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <Pill className="h-5 w-5 mr-2 text-purple-600" />
                    Today's Medicine Schedule
                </h2>
                <div className="text-center py-8 text-gray-400">
                    <Pill className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No medicines scheduled</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Pill className="h-5 w-5 mr-2 text-purple-600" />
                Today's Medicine Schedule
            </h2>

            <div className="space-y-3">
                {todaysSchedule.map((item, index) => (
                    <div
                        key={index}
                        className={`p-4 rounded-xl border-2 transition-all ${item.status === 'now'
                                ? 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-300 shadow-lg'
                                : item.status === 'upcoming'
                                    ? 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200'
                                    : 'bg-gray-50 border-gray-200 opacity-60'
                            }`}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                    <Clock className={`h-4 w-4 ${item.status === 'now' ? 'text-orange-600' :
                                            item.status === 'upcoming' ? 'text-purple-600' :
                                                'text-gray-400'
                                        }`} />
                                    <span className={`font-bold text-lg ${item.status === 'now' ? 'text-orange-700' :
                                            item.status === 'upcoming' ? 'text-purple-700' :
                                                'text-gray-500'
                                        }`}>
                                        {item.time}
                                    </span>
                                    {item.status === 'now' && (
                                        <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-bold animate-pulse">
                                            NOW
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-bold text-gray-900">{item.medicine}</h3>
                                <p className="text-sm text-gray-600">{item.dosage}</p>
                                {item.instructions && (
                                    <p className="text-sm text-gray-500 italic mt-1">
                                        📝 {item.instructions}
                                    </p>
                                )}
                            </div>
                            <div>
                                {item.status === 'past' ? (
                                    <XCircle className="h-6 w-6 text-gray-400" />
                                ) : (
                                    <CheckCircle className={`h-6 w-6 ${item.status === 'now' ? 'text-orange-500' : 'text-purple-500'
                                        }`} />
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-800">
                    <strong>Reminder:</strong> Take your medicines on time for best results.
                    Your caretaker will be notified 10 minutes before each dose.
                </p>
            </div>
        </div>
    );
}
