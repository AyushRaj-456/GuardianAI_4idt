"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { AlertTriangle, MapPin, Clock, X, Check, Image as ImageIcon } from "lucide-react";

interface AlertsViewProps {
    caretakerId: string;
}

export default function AlertsView({ caretakerId }: AlertsViewProps) {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Query alerts for this caretaker, ordered by newest first
        const q = query(
            collection(db, "alerts"),
            where("caretakerId", "==", caretakerId)
            // Note: Compound queries with orderBy often require an index in Firestore.
            // If this fails, we might need to sort client-side or create the index.
            // keeping it simple with client-side sort for now to avoid index creation delay issues for user.
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newAlerts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Client-side sort by timestamp descending
            newAlerts.sort((a: any, b: any) => {
                if (b.timestamp && a.timestamp) {
                    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                }
                return 0;
            });

            setAlerts(newAlerts);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [caretakerId]);

    const dismissAlert = async (alertId: string) => {
        try {
            await deleteDoc(doc(db, "alerts", alertId));
        } catch (error) {
            console.error("Error dismissing alert:", error);
        }
    };

    const markAsRead = async (alertId: string) => {
        try {
            await updateDoc(doc(db, "alerts", alertId), {
                read: true
            });
        } catch (error) {
            console.error("Error marking alert as read:", error);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading alerts...</div>;
    }

    if (alerts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl">
                <div className="bg-green-50 p-4 rounded-full mb-4">
                    <Check className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700">All Clear</h3>
                <p>No active warnings or alerts.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 h-full overflow-y-auto pr-2">
            <h2 className="text-xl font-bold text-gray-800 flex items-center mb-6">
                <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
                Automated Warnings
                <span className="ml-3 px-3 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-full">
                    {alerts.length}
                </span>
            </h2>

            <div className="grid gap-4">
                {alerts.map((alert) => (
                    <div
                        key={alert.id}
                        className={`bg-white rounded-xl shadow-sm border p-4 transition-all ${!alert.read ? 'border-red-200 border-l-4 border-l-red-500 shadow-md bg-red-50/10' : 'border-gray-200 opacity-90'
                            }`}
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <div className="flex items-center mb-1">
                                    <h3 className="font-bold text-gray-900 mr-2">
                                        {alert.type === 'GEOFENCE_BREACH' ? '🚨 Safe Zone Exit' : '📷 Automated Snapshot'}
                                    </h3>
                                    {!alert.read && (
                                        <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                            New
                                        </span>
                                    )}
                                </div>

                                <p className="text-sm font-medium text-gray-700 mb-2">
                                    Patient: <span className="text-blue-600">{alert.patientName || 'Unknown'}</span>
                                </p>

                                <div className="flex items-center text-xs text-gray-500 mb-3 space-x-3">
                                    <span className="flex items-center">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {alert.timestamp ? new Date(alert.timestamp).toLocaleString() : 'Just now'}
                                    </span>
                                    {alert.coordinates && (
                                        <span className="flex items-center text-blue-500">
                                            <MapPin className="h-3 w-3 mr-1" />
                                            {alert.coordinates.lat.toFixed(5)}, {alert.coordinates.lng.toFixed(5)}
                                        </span>
                                    )}
                                </div>

                                <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded-lg border border-gray-100 inline-block max-w-full">
                                    {alert.message}
                                </p>

                                {/* Snapshot Image */}
                                {alert.image && (
                                    <div className="mb-4 mt-2">
                                        <div className="relative rounded-lg overflow-hidden border border-gray-200 max-w-md">
                                            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur-sm flex items-center">
                                                <ImageIcon className="h-3 w-3 mr-1" />
                                                Safety Snapshot
                                            </div>
                                            <img
                                                src={alert.image}
                                                alt="Alert Snapshot"
                                                className="w-full h-auto object-cover"
                                                loading="lazy"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col space-y-2 ml-4">
                                <button
                                    onClick={() => dismissAlert(alert.id)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Dismiss Alert"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                                {!alert.read && (
                                    <button
                                        onClick={() => markAsRead(alert.id)}
                                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Mark as Read"
                                    >
                                        <Check className="h-5 w-5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
