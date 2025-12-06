"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import { Send, UserPlus, Clock, CheckCircle, XCircle, ShieldAlert, Save, Trash2, Pill } from "lucide-react";
import dynamic from "next/dynamic";

// Dynamically import Map component to avoid SSR issues with Leaflet
const Map = dynamic(() => import("./Map"), {
    ssr: false,
    loading: () => <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-2xl animate-pulse">Loading Map...</div>
});

import ChatSystem from "./ChatSystem";
import UnreadIndicator from "./UnreadIndicator";
import MedicineSchedule from "./MedicineSchedule";
import MedicineReminderNotification from "./MedicineReminderNotification";
import TasksView from "./TasksView";

export default function CaretakerView() {
    const { user, logout } = useAuth();
    const [patientEmail, setPatientEmail] = useState("");
    const [status, setStatus] = useState("");
    const [requests, setRequests] = useState<any[]>([]);
    const [connectedPatients, setConnectedPatients] = useState<any[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<any>(null);
    const [chatPatient, setChatPatient] = useState<any>(null);

    // Geofence State
    const [editingGeofence, setEditingGeofence] = useState<any>(null);
    const [geofenceRadius, setGeofenceRadius] = useState(500); // meters
    const [geofenceActive, setGeofenceActive] = useState(true);
    const [geofenceCenter, setGeofenceCenter] = useState<{ lat: number, lng: number } | null>(null);

    // Medicine State
    const [medicinePatient, setMedicinePatient] = useState<any>(null);

    // View State
    const [currentView, setCurrentView] = useState<'dashboard' | 'tasks'>('dashboard');

    useEffect(() => {
        if (!user) return;

        // Listen for sent requests
        const q = query(collection(db, "requests"), where("from", "==", user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubscribe();
    }, [user]);

    // Subscribe to tracking for accepted requests
    useEffect(() => {
        if (!user) return;

        const acceptedEmails = requests
            .filter(r => r.status === 'accepted')
            .map(r => r.to);

        if (acceptedEmails.length === 0) {
            setConnectedPatients([]);
            return;
        }

        const trackingQuery = query(collection(db, "tracking"), where("email", "in", acceptedEmails));
        const unsubscribeTracking = onSnapshot(trackingQuery, (trackingSnapshot) => {
            const patientsData = trackingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setConnectedPatients(patientsData);
        });

        return () => unsubscribeTracking();
    }, [user, requests]);

    // Subscribe to History for Selected Patient
    useEffect(() => {
        if (!selectedPatient) return;

        const historyQuery = query(
            collection(db, "tracking", selectedPatient.id, "history"),
            // orderBy("timestamp", "asc")
        );

        const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
            const history = snapshot.docs.map(doc => doc.data()).sort((a: any, b: any) => {
                if (a.timestamp && b.timestamp) return a.timestamp.toMillis() - b.timestamp.toMillis();
                return 0;
            });

            setSelectedPatient((prev: any) => prev ? ({ ...prev, history }) : null);
        });

        return () => unsubscribeHistory();
    }, [selectedPatient?.id]);

    const sendRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !patientEmail) return;

        try {
            setStatus("Sending...");
            await addDoc(collection(db, "requests"), {
                from: user.uid,
                fromEmail: user.email,
                fromName: user.displayName,
                to: patientEmail,
                status: "pending",
                createdAt: new Date().toISOString(),
            });
            setStatus("Request sent!");
            setPatientEmail("");
        } catch (error) {
            console.error("Error sending request:", error);
            setStatus("Error sending request.");
        }
    };

    const handleSaveGeofence = async () => {
        if (!editingGeofence) return;

        // Find the request document for this patient
        const request = requests.find(r => r.to === editingGeofence.email && r.status === 'accepted');
        if (!request) {
            alert("Could not find connection record.");
            return;
        }

        // Use custom center if set, otherwise patient's current location
        const center = geofenceCenter || editingGeofence.location;

        if (!center) {
            alert("No location data available to set Safe Zone.");
            return;
        }

        try {
            await import("firebase/firestore").then(({ updateDoc, doc }) => {
                updateDoc(doc(db, "requests", request.id), {
                    geofence: {
                        lat: center.lat,
                        lng: center.lng,
                        radius: geofenceRadius,
                        active: geofenceActive
                    }
                });
            });
            setEditingGeofence(null);
            setGeofenceCenter(null);
        } catch (error) {
            console.error("Error saving geofence:", error);
            alert("Failed to save Safe Zone.");
        }
    };

    const handleClearGeofence = async () => {
        if (!editingGeofence) return;
        const request = requests.find(r => r.to === editingGeofence.email && r.status === 'accepted');
        if (!request) return;

        if (confirm("Are you sure you want to remove the Safe Zone?")) {
            try {
                await import("firebase/firestore").then(({ updateDoc, doc, deleteField }) => {
                    updateDoc(doc(db, "requests", request.id), {
                        geofence: deleteField()
                    });
                });
                setEditingGeofence(null);
                setGeofenceCenter(null);
            } catch (error) {
                console.error("Error clearing geofence:", error);
            }
        }
    };

    // Extract active geofences for Map
    const activeGeofences = requests
        .filter(r => r.status === 'accepted' && r.geofence && r.geofence.active)
        .map(r => ({
            lat: r.geofence.lat,
            lng: r.geofence.lng,
            radius: r.geofence.radius,
            color: 'red'
        }));

    return (
        <div className="p-6 max-w-6xl mx-auto h-screen flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Caretaker Dashboard</h1>
                    <p className="text-gray-500">Monitor and manage your patients</p>
                </div>
                <div className="flex items-center space-x-4">
                    <a href="/download" className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium">
                        Get App
                    </a>
                    <button
                        onClick={logout}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium"
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex space-x-2 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setCurrentView('dashboard')}
                    className={`px-6 py-3 font-semibold transition-all border-b-2 ${currentView === 'dashboard'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    🏠 Dashboard
                </button>
                <button
                    onClick={() => setCurrentView('tasks')}
                    className={`px-6 py-3 font-semibold transition-all border-b-2 ${currentView === 'tasks'
                        ? 'border-purple-600 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    📋 Tasks
                </button>
            </div>

            {currentView === 'tasks' ? (
                /* Tasks View */
                user && <TasksView caretakerId={user.uid} />
            ) : (

                <div className="grid md:grid-cols-3 gap-6 flex-1 min-h-0">
                    {/* Sidebar */}
                    <div className="md:col-span-1 space-y-6 overflow-y-auto pr-2">
                        {/* Add Patient */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-semibold mb-4 flex items-center">
                                <UserPlus className="h-5 w-5 mr-2 text-blue-600" />
                                Add Patient
                            </h2>
                            <form onSubmit={sendRequest} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Patient Email</label>
                                    <input
                                        type="email"
                                        value={patientEmail}
                                        onChange={(e) => setPatientEmail(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        placeholder="patient@example.com"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center font-medium"
                                >
                                    <Send className="h-4 w-4 mr-2" />
                                    Send Request
                                </button>
                                {status && <p className="text-sm text-center text-gray-600">{status}</p>}
                            </form>
                        </div>

                        {/* Requests List */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-semibold mb-4">Requests</h2>
                            <div className="space-y-3">
                                {requests.length === 0 ? (
                                    <p className="text-gray-400 text-sm">No requests.</p>
                                ) : (
                                    requests.map((req) => (
                                        <div key={req.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="overflow-hidden">
                                                <p className="text-sm font-medium text-gray-900 truncate">{req.to}</p>
                                                <p className="text-xs text-gray-500">{new Date(req.createdAt).toLocaleDateString()}</p>
                                            </div>
                                            <div className="flex-shrink-0 ml-2">
                                                {req.status === 'pending' && <Clock className="h-5 w-5 text-yellow-500" />}
                                                {req.status === 'accepted' && <CheckCircle className="h-5 w-5 text-green-500" />}
                                                {req.status === 'rejected' && <XCircle className="h-5 w-5 text-red-500" />}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Connected Patients List */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-semibold mb-4">Active Patients</h2>
                            <div className="space-y-3">
                                {connectedPatients.length === 0 ? (
                                    <p className="text-gray-400 text-sm">No active patients.</p>
                                ) : (
                                    connectedPatients.map((patient) => (
                                        <div key={patient.id} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-900">{patient.name || patient.email}</p>
                                                        <p className="text-xs text-gray-500 mt-1">
                                                            Status: <span className="font-semibold text-blue-600">{patient.status}</span>
                                                            {patient.isSimulated && <span className="text-red-500 font-bold ml-1 text-xs">(Simulated)</span>}
                                                        </p>
                                                        <p className="text-xs text-gray-400">
                                                            Last active: {new Date(patient.lastActive).toLocaleTimeString()}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* First row of buttons */}
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => setSelectedPatient(patient)}
                                                        className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-200 transition-colors"
                                                    >
                                                        📍 Locate
                                                    </button>
                                                    <div className="relative flex-1">
                                                        <button
                                                            onClick={() => setChatPatient(patient)}
                                                            className="w-full px-3 py-2 bg-green-100 text-green-700 text-xs font-medium rounded-lg hover:bg-green-200 transition-colors"
                                                        >
                                                            💬 Chat
                                                        </button>
                                                        {/* Notification Dot */}
                                                        <div className="absolute -top-1 -right-1">
                                                            <UnreadIndicator
                                                                chatId={[user?.uid || "", patient.id].sort().join("_")}
                                                                currentUserId={user?.uid || ""}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Second row of buttons */}
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingGeofence(patient);
                                                            // Pre-fill if exists
                                                            const req = requests.find(r => r.to === patient.email);
                                                            if (req?.geofence) {
                                                                setGeofenceRadius(req.geofence.radius);
                                                                setGeofenceActive(req.geofence.active);
                                                                setGeofenceCenter({ lat: req.geofence.lat, lng: req.geofence.lng });
                                                            } else {
                                                                setGeofenceRadius(500);
                                                                setGeofenceActive(true);
                                                                setGeofenceCenter(patient.location ? { ...patient.location } : null);
                                                            }
                                                        }}
                                                        className="flex-1 px-3 py-2 bg-red-100 text-red-700 text-xs font-medium rounded-lg hover:bg-red-200 transition-colors"
                                                        title="Set Safe Zone"
                                                    >
                                                        🛡️ Safe Zone
                                                    </button>
                                                    <button
                                                        onClick={() => setMedicinePatient(patient)}
                                                        className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 text-xs font-medium rounded-lg hover:bg-purple-200 transition-colors"
                                                        title="Medicine Schedule"
                                                    >
                                                        💊 Medicine
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Map Area - Reduced to half size */}
                    <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative" style={{ height: '400px' }}>
                        <Map
                            patients={connectedPatients}
                            selectedPatient={selectedPatient}
                            geofences={
                                // Show the editing geofence dynamically if editing
                                editingGeofence && geofenceCenter
                                    ? [...activeGeofences.filter(g => g !== activeGeofences.find(a => a.lat === geofenceCenter.lat && a.lng === geofenceCenter.lng)), { lat: geofenceCenter.lat, lng: geofenceCenter.lng, radius: geofenceRadius, color: 'orange' }]
                                    : activeGeofences
                            }
                            onMapClick={(lat, lng) => {
                                if (editingGeofence) {
                                    setGeofenceCenter({ lat, lng });
                                }
                            }}
                        />

                        {/* Geofence Modal Overlay */}
                        {editingGeofence && (
                            <div className="absolute top-4 right-4 z-[1000] bg-white p-4 rounded-xl shadow-xl border border-gray-200 w-72">
                                <h3 className="font-bold text-gray-900 mb-2 flex items-center">
                                    <ShieldAlert className="h-5 w-5 text-red-600 mr-2" />
                                    Set Safe Zone
                                </h3>
                                <p className="text-xs text-gray-500 mb-4">
                                    Alert if {editingGeofence.name} leaves this radius.
                                    <br />
                                    <span className="text-blue-600 font-medium">Click on map to relocate center.</span>
                                </p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-semibold text-gray-700">Radius: {geofenceRadius}m</label>
                                        <input
                                            type="range"
                                            min="100"
                                            max="5000"
                                            step="100"
                                            value={geofenceRadius}
                                            onChange={(e) => setGeofenceRadius(Number(e.target.value))}
                                            className="w-full mt-1"
                                        />
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <label className="text-sm text-gray-700">Active Monitoring</label>
                                        <input
                                            type="checkbox"
                                            checked={geofenceActive}
                                            onChange={(e) => setGeofenceActive(e.target.checked)}
                                            className="h-4 w-4 text-blue-600 rounded"
                                        />
                                    </div>

                                    <div className="flex space-x-2 pt-2">
                                        <button
                                            onClick={handleSaveGeofence}
                                            className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center justify-center"
                                        >
                                            <Save className="h-4 w-4 mr-1" /> Save
                                        </button>
                                        <button
                                            onClick={() => setEditingGeofence(null)}
                                            className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleClearGeofence}
                                        className="w-full mt-2 bg-red-50 text-red-600 py-2 rounded-lg text-sm font-medium hover:bg-red-100 flex items-center justify-center"
                                    >
                                        <Trash2 className="h-4 w-4 mr-1" /> Remove Safe Zone
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Chat System Overlay */}
                        {chatPatient && user && (
                            <ChatSystem
                                currentUserId={user.uid}
                                otherUserId={chatPatient.id} // Using the patient's UID (which is the doc ID in tracking)
                                otherUserName={chatPatient.name || chatPatient.email}
                                onClose={() => setChatPatient(null)}
                            />
                        )}

                        {/* Medicine Schedule Modal */}
                        {medicinePatient && user && (
                            <MedicineSchedule
                                patientId={medicinePatient.id}
                                patientName={medicinePatient.name || medicinePatient.email}
                                caretakerId={user.uid}
                                onClose={() => setMedicinePatient(null)}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Medicine Reminder Notifications */}
            {user && <MedicineReminderNotification caretakerId={user.uid} />}
        </div>
    );
}
