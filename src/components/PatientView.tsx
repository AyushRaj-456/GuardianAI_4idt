"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, updateDoc, doc, setDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { Bell, Shield, MapPin, MessageCircle, AlertTriangle, Pill } from "lucide-react";
import { calculateDistance } from "@/lib/utils";

import ChatSystem from "./ChatSystem";
import UnreadIndicator from "./UnreadIndicator";
import PatientMedicineView from "./PatientMedicineView";
import MedicineManager from "./MedicineManager";
import PatientMedicineNotifications from "./PatientMedicineNotifications";
import AIChatBot from "./AIChatBot";
import HealthAdvisorView from "./HealthAdvisorView";

import html2canvas from "html2canvas";
import dynamic from "next/dynamic";

// Dynamically import Map component to avoid SSR issues with Leaflet
const Map = dynamic(() => import("./Map"), {
    ssr: false,
    loading: () => <div className="h-full w-full flex items-center justify-center bg-gray-100 animate-pulse">Loading Map...</div>
});

export default function PatientView() {
    const { user, logout } = useAuth();
    const [requests, setRequests] = useState<any[]>([]);
    const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [locationStatus, setLocationStatus] = useState<string>("Initializing...");
    const [isSimulated, setIsSimulated] = useState(false);
    const [manualSimulation, setManualSimulation] = useState(false);
    const [chatCaretaker, setChatCaretaker] = useState<any>(null); // For HUMAN chat

    // Geofence Status Tracking
    const [geofenceStatus, setGeofenceStatus] = useState<{ [key: string]: boolean }>({});

    // Medicine Manager State
    const [isMedicineManagerOpen, setIsMedicineManagerOpen] = useState(false);

    // Health Advisor State
    const [isHealthAdvisorOpen, setIsHealthAdvisorOpen] = useState(false);

    // 1. Handle Connection Requests
    useEffect(() => {
        if (!user?.email) return;
        const q = query(collection(db, "requests"), where("to", "==", user.email));
        return onSnapshot(q, (snapshot) => {
            setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
    }, [user]);

    // 2. Robust Location Tracking & Geofencing (Preserved from previous logic)
    useEffect(() => {
        if (!user) return;
        let watchId: number | undefined;

        const updateLocation = async (lat: number, lng: number, simulated: boolean) => {
            setLocation({ lat, lng });
            setIsSimulated(simulated);
            setLocationStatus(simulated ? "Simulated Mode (Bangalore)" : "Active (GPS)");

            try {
                await setDoc(doc(db, "tracking", user.uid), {
                    email: user.email,
                    name: user.displayName,
                    location: { lat, lng },
                    lastActive: new Date().toISOString(),
                    status: simulated ? "Simulated" : "Active",
                    isSimulated: simulated
                }, { merge: true });

                // Add to History (Throttled logging could be added here)
                await addDoc(collection(db, "tracking", user.uid, "history"), {
                    lat, lng, timestamp: serverTimestamp()
                });
            } catch (err) {
                console.error("Error updating location:", err);
            }
        };

        if (manualSimulation) {
            updateLocation(12.9716, 77.5946, true);
            return;
        }

        if ("geolocation" in navigator) {
            watchId = navigator.geolocation.watchPosition(
                (position) => updateLocation(position.coords.latitude, position.coords.longitude, false),
                (err) => {
                    console.error("Geolocation error:", err);
                    let erroMsg = "Location Error. Switching to Simulation.";

                    switch (err.code) {
                        case err.PERMISSION_DENIED:
                            erroMsg = "Location denied. Please enable permission.";
                            break;
                        case err.POSITION_UNAVAILABLE:
                            erroMsg = "Location unavailable. Check OS settings.";
                            break;
                        case err.TIMEOUT:
                            erroMsg = "Location timed out. Retrying...";
                            break;
                    }

                    setLocationStatus(erroMsg);
                    updateLocation(12.9716, 77.5946, true);
                },
                { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
            );
        } else {
            setLocationStatus("Geolocation not supported. Using Simulation.");
            updateLocation(12.9716, 77.5946, true);
        }

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
        }
    }, [user, manualSimulation]);

    // Geofence Monitoring
    useEffect(() => {
        if (!location || !user) return;
        requests.forEach(async (req) => {
            if (req.status === 'accepted' && req.geofence && req.geofence.active) {
                const dist = calculateDistance(location.lat, location.lng, req.geofence.lat, req.geofence.lng);
                const isOutside = dist > req.geofence.radius;
                const wasOutside = geofenceStatus[req.id] || false;

                if (isOutside && !wasOutside) {
                    // BREACH
                    try {
                        console.log("📸 Capturing Geofence Breach Snapshot...");
                        let snapshot = null;
                        const mapElement = document.getElementById('map-container');

                        if (mapElement) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                            const canvas = await html2canvas(mapElement, { useCORS: true });
                            snapshot = canvas.toDataURL("image/png");
                        }

                        // Create Alert in 'alerts' collection instead of Chat
                        await addDoc(collection(db, "alerts"), {
                            caretakerId: req.from, // The caretaker who set the geofence
                            patientId: user.uid,
                            patientName: user.displayName,
                            type: "GEOFENCE_BREACH",
                            message: `Patient exited Safe Zone! Distance: ${Math.round(dist)}m`,
                            timestamp: new Date().toISOString(),
                            read: false,
                            coordinates: { lat: location.lat, lng: location.lng },
                            image: snapshot // Attach the snapshot directly to the alert
                        });
                        console.log("Alert sent to caretaker:", req.from);

                        // Legacy Chat Alert REMOVED - separating concerns as requested

                    } catch (err) {
                        console.error("Failed to send alert:", err);
                    }
                    setGeofenceStatus(prev => ({ ...prev, [req.id]: true }));
                } else if (!isOutside && wasOutside) {
                    setGeofenceStatus(prev => ({ ...prev, [req.id]: false }));
                }
            }
        });
    }, [location, requests, user, geofenceStatus]);


    const handleRequest = async (id: string, status: "accepted" | "rejected") => {
        await updateDoc(doc(db, "requests", id), { status });
    };

    return (
        <div className="min-h-screen w-full bg-gray-50">
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-24">
                {/* Notification Handler */}
                {user && <PatientMedicineNotifications patientId={user.uid} />}

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">Patient Dashboard</h1>
                        <p className="text-sm sm:text-base text-gray-500">Guardian AI v1.0</p>
                    </div>
                    <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
                        <a href="/download" className="flex-1 sm:flex-none text-center text-xs sm:text-sm bg-blue-50 text-blue-600 px-3 py-2 rounded-lg font-medium hover:bg-blue-100 transition-colors">
                            Get App
                        </a>
                        <button onClick={logout} className="flex-1 sm:flex-none text-xs sm:text-sm text-red-600 hover:text-red-800 font-medium px-3 py-2">
                            Logout
                        </button>
                    </div>
                </div>

                {/* Status Card */}
                <div className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border mb-4 sm:mb-6 transition-all ${isSimulated ? "bg-orange-50 border-orange-100" : "bg-white border-gray-100"}`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <div className={`h-3 w-3 rounded-full mr-3 ${isSimulated ? "bg-orange-500 animate-pulse" : "bg-green-500 animate-pulse"}`}></div>
                            <span className={`text-sm sm:text-base font-semibold ${isSimulated ? "text-orange-700" : "text-green-700"}`}>
                                {locationStatus}
                            </span>
                        </div>
                        {isSimulated && <AlertTriangle className="h-5 w-5 text-orange-400" />}
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200/50">
                        <span className="text-sm text-gray-600">Simulate Location</span>
                        <button
                            onClick={() => setManualSimulation(!manualSimulation)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${manualSimulation ? 'bg-blue-600' : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${manualSimulation ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>

                    <div className="mt-4 flex items-center text-gray-500 text-xs sm:text-sm">
                        <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="truncate">{location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Locating..."}</span>
                    </div>
                </div>

                {/* Medicine Schedule Section */}
                {user && (
                    <div className="mb-4 sm:mb-6 relative">
                        <PatientMedicineView patientId={user.uid} />
                        <button
                            onClick={() => setIsMedicineManagerOpen(true)}
                            className="w-full mt-2 bg-purple-50 text-purple-600 py-3 rounded-xl text-sm font-semibold hover:bg-purple-100 transition-colors flex items-center justify-center border border-purple-100"
                        >
                            <Pill className="h-4 w-4 mr-2" />
                            Manage Medicine Cabinet
                        </button>
                        <button
                            onClick={() => setIsHealthAdvisorOpen(true)}
                            className="w-full mt-2 bg-teal-50 text-teal-600 py-3 rounded-xl text-sm font-semibold hover:bg-teal-100 transition-colors flex items-center justify-center border border-teal-100"
                        >
                            🌿 Open Health Advisor
                        </button>
                    </div>
                )}

                {isMedicineManagerOpen && user && (
                    <MedicineManager
                        patientId={user.uid}
                        patientName={user.displayName || "Me"}
                        currentUserRole="patient"
                        currentUserId={user.uid}
                        onClose={() => setIsMedicineManagerOpen(false)}
                    />
                )}

                {isHealthAdvisorOpen && user && (
                    <div className="fixed inset-0 z-[6000] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200">
                        <div className="w-full max-w-5xl h-[85vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                            <HealthAdvisorView
                                user={user}
                                role="patient"
                                contextData={{ caretakers: requests.filter(r => r.status === 'accepted').map(r => ({ id: r.from, name: r.fromName })) }}
                                onClose={() => setIsHealthAdvisorOpen(false)}
                            />
                        </div>
                    </div>
                )}

                {/* Connection Requests */}
                {requests.filter(r => r.status === 'pending').length > 0 && (
                    <div className="mb-6 bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                        <h2 className="text-sm font-bold text-yellow-800 mb-3 flex items-center">
                            <Bell className="h-4 w-4 mr-2" />
                            New Connection Request
                        </h2>
                        {requests.filter(r => r.status === 'pending').map((req) => (
                            <div key={req.id} className="bg-white p-3 rounded-lg shadow-sm">
                                <p className="text-sm text-gray-600 mb-3">
                                    <strong>{req.fromName}</strong> wants to monitor you.
                                </p>
                                <div className="flex space-x-2">
                                    <button onClick={() => handleRequest(req.id, "accepted")} className="flex-1 bg-blue-600 text-white py-1.5 rounded text-xs font-bold">Accept</button>
                                    <button onClick={() => handleRequest(req.id, "rejected")} className="flex-1 bg-gray-100 text-gray-700 py-1.5 rounded text-xs font-bold">Reject</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Active Caretakers List for Chat */}
                {requests.filter(r => r.status === 'accepted').length > 0 && (
                    <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <h2 className="text-sm font-bold text-blue-800 mb-3 flex items-center">
                            <Shield className="h-4 w-4 mr-2" />
                            Your Caretakers
                        </h2>
                        {requests.filter(r => r.status === 'accepted').map((req) => (
                            <div key={req.id} className="bg-white p-3 rounded-lg shadow-sm mb-2 flex justify-between items-center">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{req.fromName}</p>
                                </div>
                                <div className="relative">
                                    <button onClick={() => setChatCaretaker(req)} className="bg-green-100 text-green-700 p-2 rounded-full hover:bg-green-200 transition-colors">
                                        <MessageCircle className="h-4 w-4" />
                                    </button>
                                    <div className="absolute -top-1 -right-1">
                                        <UnreadIndicator chatId={[user?.uid, req.from].sort().join("_")} currentUserId={user?.uid || ""} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Human Chat System Overlay */}
                {chatCaretaker && user && (
                    <ChatSystem
                        currentUserId={user.uid}
                        otherUserId={chatCaretaker.from}
                        otherUserName={chatCaretaker.fromName}
                        onClose={() => setChatCaretaker(null)}
                        onCaptureSnapshot={async () => {
                            const mapElement = document.getElementById('map-container');
                            if (mapElement) {
                                const canvas = await html2canvas(mapElement, { useCORS: true });
                                return canvas.toDataURL("image/png");
                            }
                            return null;
                        }}
                    />
                )}

                {/* Map Display */}
                <div className="mb-4 sm:mb-6 h-64 sm:h-80 lg:h-96 rounded-xl overflow-hidden border border-gray-200 shadow-sm relative" id="map-container">
                    <Map
                        patients={[{
                            id: user?.uid,
                            name: user?.displayName,
                            location: location,
                            isSimulated: isSimulated,
                            lastActive: new Date().toISOString()
                        }]}
                        selectedPatient={null}
                    />
                </div>

                {/* AI Chatbot (Shared Component) */}
                {user && (
                    <AIChatBot
                        user={user}
                        role="patient"
                        targetPatientId={user.uid}
                        contextData={{
                            // Pass connected caretakers for messaging
                            caretakers: requests.filter(r => r.status === 'accepted').map(r => ({ id: r.from, name: r.fromName }))
                        }}
                    />
                )}
            </div>
        </div>
    );
}
