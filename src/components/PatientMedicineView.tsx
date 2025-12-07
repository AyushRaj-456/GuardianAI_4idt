"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, setDoc, doc } from "firebase/firestore";
import { Clock, CheckCircle2, Circle, Activity } from "lucide-react";

interface PatientMedicineViewProps {
    patientId: string;
}

export default function PatientMedicineView({ patientId }: PatientMedicineViewProps) {
    const [medicines, setMedicines] = useState<any[]>([]);
    const [schedule, setSchedule] = useState<any[]>([]);

    useEffect(() => {
        const q = query(
            collection(db, "medicines"),
            where("patientId", "==", patientId),
            where("active", "==", true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const meds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMedicines(meds);
            generateSchedule(meds);
        });

        return () => unsubscribe();
    }, [patientId]);

    const generateSchedule = (meds: any[]) => {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
        const currentHour = today.getHours();
        const currentMinute = today.getMinutes();

        let dailySchedule: any[] = [];

        meds.forEach(med => {
            if (med.times && Array.isArray(med.times)) {
                med.times.forEach((time: string) => {
                    const [h, m] = time.split(':').map(Number);

                    // Status Calculation
                    let status = 'upcoming'; // default
                    const timeKey = `${dateStr}_${time}`;
                    const isTaken = med.takenDoses && med.takenDoses[timeKey];

                    if (isTaken) {
                        status = 'taken';
                    } else {
                        if (h < currentHour || (h === currentHour && m < currentMinute)) {
                            status = 'missed';
                        } else if (h === currentHour && m >= currentMinute && m <= currentMinute + 60) {
                            status = 'coming_soon';
                        }
                    }

                    dailySchedule.push({
                        ...med,
                        time,
                        status,
                        sortTime: h * 60 + m
                    });
                });
            }
        });

        // Sort by time
        dailySchedule.sort((a, b) => a.sortTime - b.sortTime);
        setSchedule(dailySchedule);
    };

    const markAsTaken = async (medId: string, time: string) => {
        const todayStr = new Date().toISOString().split('T')[0];
        const key = `${todayStr}_${time}`;

        try {
            await setDoc(doc(db, "medicines", medId), {
                takenDoses: {
                    [key]: true // Use standard merge setDoc
                }
            }, { merge: true });
        } catch (e) {
            console.error("Error marking medicine as taken:", e);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <Clock className="h-5 w-5 mr-2 text-blue-600" />
                Today's Schedule
            </h2>

            {schedule.length === 0 ? (
                <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No medicines scheduled for today.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {schedule.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${item.status === 'taken' ? 'bg-green-50 border-green-100' :
                                item.status === 'missed' ? 'bg-red-50 border-red-100' :
                                    'bg-gray-50 border-gray-100 hover:shadow-md'
                            }`}>
                            <div className="flex items-center space-x-3">
                                <div className={`text-sm font-bold w-12 text-center py-1 rounded-md ${item.status === 'taken' ? 'bg-green-200 text-green-800' :
                                        item.status === 'missed' ? 'bg-red-200 text-red-800' :
                                            'bg-blue-100 text-blue-700'
                                    }`}>
                                    {item.time}
                                </div>
                                <div>
                                    <h3 className={`font-bold text-base ${item.status === 'taken' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                        {item.name}
                                    </h3>
                                    <p className="text-xs text-gray-500 flex items-center">
                                        {item.dosage}
                                        {item.instructions && <span className="ml-1">• {item.instructions}</span>}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => item.status !== 'taken' && markAsTaken(item.id, item.time)}
                                disabled={item.status === 'taken'}
                                className={`p-2 rounded-full transition-all ${item.status === 'taken' ? 'text-green-600 bg-green-100' :
                                        'text-gray-300 hover:text-green-600 hover:bg-green-50'
                                    }`}
                                title={item.status === 'taken' ? "Taken" : "Mark as Taken"}
                            >
                                {item.status === 'taken' ? (
                                    <CheckCircle2 className="h-6 w-6" />
                                ) : (
                                    <Circle className="h-6 w-6" />
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
