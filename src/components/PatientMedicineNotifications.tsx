"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";

interface PatientMedicineNotificationsProps {
    patientId: string;
}

export default function PatientMedicineNotifications({ patientId }: PatientMedicineNotificationsProps) {
    const [medicines, setMedicines] = useState<any[]>([]);

    // Request Notification Permission on mount
    useEffect(() => {
        if ("Notification" in window) {
            if (Notification.permission !== "granted") {
                Notification.requestPermission();
            }
        }
    }, []);

    // Fetch Medicines
    useEffect(() => {
        const q = query(
            collection(db, "medicines"),
            where("patientId", "==", patientId),
            where("active", "==", true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMedicines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubscribe();
    }, [patientId]);

    // Schedule Notifications
    useEffect(() => {
        if (!medicines.length) return;

        const timers: NodeJS.Timeout[] = [];

        const scheduleAlarms = () => {
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinute = now.getMinutes();
            const currentSeconds = now.getSeconds();

            medicines.forEach(med => {
                if (!med.times || !Array.isArray(med.times)) return;

                med.times.forEach((timeStr: string) => {
                    const [h, m] = timeStr.split(':').map(Number);

                    // Calculate delay until this time
                    const targetTime = new Date();
                    targetTime.setHours(h, m, 0, 0);

                    if (targetTime.getTime() <= now.getTime()) {
                        // If time has passed for today, ignore (or maybe schedule for tomorrow? 
                        // Simplified: just check if it matches NOW within a minute window)
                        return;
                    }

                    const delay = targetTime.getTime() - now.getTime();

                    // Only schedule if it's within the next hour to avoid crazy long timeouts (re-run logic handles rotation)
                    // Actually, setting a timeout for 5 hours is fine in JS.
                    if (delay < 24 * 60 * 60 * 1000) {
                        const timer = setTimeout(() => {
                            sendNotification(med);
                        }, delay);
                        timers.push(timer);
                    }
                });
            });
        };

        scheduleAlarms();

        // Re-schedule every hour just in case user keeps tab open for days
        const interval = setInterval(scheduleAlarms, 60 * 60 * 1000);

        return () => {
            timers.forEach(clearTimeout);
            clearInterval(interval);
        };
    }, [medicines]);

    const sendNotification = (medicine: any) => {
        if ("Notification" in window && Notification.permission === "granted") {
            const n = new Notification("Medicine Time!", {
                body: `Time to take ${medicine.name} (${medicine.dosage}).\n${medicine.instructions || ""}`,
                icon: "/icon-192x192.png", // Verify path, usually defaults to favicon if missing
                tag: `med-${medicine.id}-${Date.now()}` // Prevent duplicate
            });

            // Audio Alert
            const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
            audio.play().catch(e => console.log("Audio play failed interaction policy", e));
        }
    };

    return null; // Invisible component
}
