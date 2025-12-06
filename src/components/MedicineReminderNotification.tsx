// Medicine Reminder Notification Component
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Bell, Pill, X, Clock } from "lucide-react";

interface MedicineReminder {
    id: string;
    medicineName: string;
    dosage: string;
    time: string;
    patientName: string;
    patientId: string;
}

interface MedicineReminderNotificationProps {
    caretakerId: string;
}

export default function MedicineReminderNotification({ caretakerId }: MedicineReminderNotificationProps) {
    const [reminders, setReminders] = useState<MedicineReminder[]>([]);
    const [dismissedReminders, setDismissedReminders] = useState<Set<string>>(new Set());

    useEffect(() => {
        const checkReminders = () => {
            const now = new Date();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            // Get time 10 minutes from now for advance reminder
            const reminderTime = new Date(now.getTime() + 10 * 60000);
            const reminderTimeStr = `${reminderTime.getHours().toString().padStart(2, '0')}:${reminderTime.getMinutes().toString().padStart(2, '0')}`;

            const q = query(
                collection(db, "medicines"),
                where("caretakerId", "==", caretakerId),
                where("active", "==", true)
            );

            const unsubscribe = onSnapshot(q, async (snapshot) => {
                const upcomingReminders: MedicineReminder[] = [];

                for (const docSnapshot of snapshot.docs) {
                    const medicine = docSnapshot.data();

                    // Check if any time slot is coming up in 10 minutes
                    for (const time of medicine.times) {
                        if (time === reminderTimeStr) {
                            const reminderId = `${docSnapshot.id}-${time}`;

                            // Don't show if already dismissed
                            if (!dismissedReminders.has(reminderId)) {
                                // Get patient name
                                const patientName = medicine.patientName || "Patient";

                                upcomingReminders.push({
                                    id: reminderId,
                                    medicineName: medicine.name,
                                    dosage: medicine.dosage,
                                    time: time,
                                    patientName: patientName,
                                    patientId: medicine.patientId
                                });
                            }
                        }
                    }
                }

                setReminders(upcomingReminders);
            });

            return unsubscribe;
        };

        // Check immediately
        const unsubscribe = checkReminders();

        // Check every minute
        const interval = setInterval(() => {
            checkReminders();
        }, 60000);

        return () => {
            if (unsubscribe) unsubscribe();
            clearInterval(interval);
        };
    }, [caretakerId, dismissedReminders]);

    const dismissReminder = (reminderId: string) => {
        setDismissedReminders(prev => new Set(prev).add(reminderId));
        setReminders(prev => prev.filter(r => r.id !== reminderId));
    };

    if (reminders.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[9998] space-y-3 max-w-sm">
            {reminders.map((reminder) => (
                <div
                    key={reminder.id}
                    className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-4 rounded-xl shadow-2xl border-2 border-white animate-bounce"
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                            <Bell className="h-5 w-5 animate-pulse" />
                            <span className="font-bold text-sm">Medicine Reminder</span>
                        </div>
                        <button
                            onClick={() => dismissReminder(reminder.id)}
                            className="hover:bg-white/20 p-1 rounded transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="space-y-1">
                        <p className="font-bold text-lg">{reminder.patientName}</p>
                        <div className="flex items-center space-x-2 text-sm">
                            <Pill className="h-4 w-4" />
                            <span>{reminder.medicineName} - {reminder.dosage}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm bg-white/20 px-2 py-1 rounded-lg mt-2">
                            <Clock className="h-4 w-4" />
                            <span className="font-semibold">In 10 minutes ({reminder.time})</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
