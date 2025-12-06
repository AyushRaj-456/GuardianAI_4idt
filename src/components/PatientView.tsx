"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, updateDoc, doc, setDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { Bell, Check, X, Shield, Activity, MapPin, MessageCircle, Send as SendIcon, Minimize2, AlertTriangle } from "lucide-react";
import { calculateDistance } from "@/lib/utils";

import ChatSystem from "./ChatSystem";
import UnreadIndicator from "./UnreadIndicator";
import PatientMedicineView from "./PatientMedicineView";
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
    const [chatCaretaker, setChatCaretaker] = useState<any>(null);

    // Geofence Status Tracking (to prevent alert spam)
    const [geofenceStatus, setGeofenceStatus] = useState<{ [key: string]: boolean }>({}); // requestId -> isOutside

    // Chat State
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessage, setChatMessage] = useState("");
    const [chatHistory, setChatHistory] = useState<{ role: "user" | "model", parts: string }[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // 1. Handle Connection Requests
    useEffect(() => {
        if (!user?.email) return;
        // Fetch ALL requests to show both pending (requests) and accepted (active caretakers)
        const q = query(collection(db, "requests"), where("to", "==", user.email));
        return onSnapshot(q, (snapshot) => {
            setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
    }, [user]);

    // 2. Robust Location Tracking
    useEffect(() => {
        if (!user) return;

        let watchId: number | undefined;

        const updateLocation = async (lat: number, lng: number, simulated: boolean) => {
            setLocation({ lat, lng });
            setIsSimulated(simulated);
            setLocationStatus(simulated ? "Simulated Mode (Bangalore)" : "Active (GPS)");

            // Update Firestore
            try {
                await setDoc(doc(db, "tracking", user.uid), {
                    email: user.email,
                    name: user.displayName,
                    location: { lat, lng },
                    lastActive: new Date().toISOString(),
                    status: simulated ? "Simulated" : "Active",
                    isSimulated: simulated
                }, { merge: true });

                // Add to History (Throttled: every 1 minute approx, handled by effect dependency or check last entry)
                // For simplicity, we'll just add it here but in production should be throttled.
                // We will use a separate subcollection to avoid bloating the main doc.
                // Check if we should add history (e.g. if distance > 10m from last point)
                // For this prototype, we'll just add it.
                await addDoc(collection(db, "tracking", user.uid, "history"), {
                    lat,
                    lng,
                    timestamp: serverTimestamp()
                });

            } catch (err) {
                console.error("Error updating location:", err);
            }
        };

        // If Manual Simulation is ON, force Bangalore location
        if (manualSimulation) {
            updateLocation(12.9716, 77.5946, true);
            return; // Stop here, don't run GPS
        }

        // Manual simulation is OFF, try to use real GPS
        if ("geolocation" in navigator) {
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    updateLocation(position.coords.latitude, position.coords.longitude, false);
                },
                (err) => {
                    console.error("Geolocation error:", err);
                    let errorMessage = "Unable to retrieve your location";

                    switch (err.code) {
                        case 1: errorMessage = "Location permission denied."; break;
                        case 2: errorMessage = "Location unavailable."; break;
                        case 3: errorMessage = "Location timeout."; break;
                    }
                    setLocationStatus(`${errorMessage} Switching to Simulation.`);
                    // Fallback to simulation on error
                    updateLocation(12.9716, 77.5946, true);
                },
                {
                    enableHighAccuracy: false,
                    timeout: 15000,
                    maximumAge: 10000
                }
            );
        } else {
            setLocationStatus("Geolocation not supported. Using Simulation.");
            updateLocation(12.9716, 77.5946, true);
        }

        return () => {
            if (watchId !== undefined) {
                navigator.geolocation.clearWatch(watchId);
            }
        };
    }, [user, manualSimulation]);

    // 2.5 Geofence Monitoring
    useEffect(() => {
        if (!location || !user) return;

        requests.forEach(async (req) => {
            if (req.status === 'accepted' && req.geofence && req.geofence.active) {
                const dist = calculateDistance(
                    location.lat,
                    location.lng,
                    req.geofence.lat,
                    req.geofence.lng
                );

                const isOutside = dist > req.geofence.radius;
                const wasOutside = geofenceStatus[req.id] || false;

                if (isOutside && !wasOutside) {
                    // Transitioned to OUTSIDE -> Send Alert
                    console.log(`⚠️ Geofence Breach! Distance: ${dist}m > ${req.geofence.radius}m`);

                    try {
                        const chatId = [user.uid, req.from].sort().join("_");
                        await addDoc(collection(db, "chats", chatId, "messages"), {
                            text: `⚠️ AUTOMATED ALERT: I have left the safe zone! (Distance: ${Math.round(dist)}m from center)`,
                            senderId: user.uid,
                            type: "text",
                            createdAt: serverTimestamp(),
                            isAlert: true
                        });
                    } catch (err) {
                        console.error("Failed to send alert:", err);
                    }

                    setGeofenceStatus(prev => ({ ...prev, [req.id]: true }));
                } else if (!isOutside && wasOutside) {
                    // Transitioned to INSIDE -> Reset
                    setGeofenceStatus(prev => ({ ...prev, [req.id]: false }));

                    // Optional: Send "Back in safe zone" message? 
                    // Keeping it simple for now.
                }
            }
        });
    }, [location, requests, user, geofenceStatus]);

    // 2.6 Automated Snapshots (12 PM and 12 AM)
    useEffect(() => {
        if (!user || !location) return;

        const checkAndCaptureSnapshot = async () => {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();

            // Check for 12:00 PM (12:00) or 12:00 AM (00:00)
            // Allow a 5-minute window
            const isNoon = hours === 12 && minutes < 5;
            const isMidnight = hours === 0 && minutes < 5;

            if (!isNoon && !isMidnight) return;

            const todayStr = now.toISOString().split('T')[0];
            const summaryId = `${user.uid}_${todayStr}`;
            const summaryRef = doc(db, "daily_summaries", summaryId);

            try {
                const summaryDoc = await import("firebase/firestore").then(({ getDoc }) => getDoc(summaryRef));
                const data = summaryDoc.exists() ? summaryDoc.data() : {};

                if ((isNoon && data.noonSnapshotSent) || (isMidnight && data.midnightSnapshotSent)) {
                    return; // Already sent
                }

                console.log("📸 Capturing Automated Snapshot...");

                // Capture Map
                const mapElement = document.getElementById('map-container');
                if (mapElement) {
                    const canvas = await html2canvas(mapElement, { useCORS: true });
                    const base64Image = canvas.toDataURL("image/png");

                    // Send to all accepted caretakers
                    const acceptedRequests = requests.filter(r => r.status === 'accepted');

                    for (const req of acceptedRequests) {
                        const chatId = [user.uid, req.from].sort().join("_");
                        await addDoc(collection(db, "chats", chatId, "messages"), {
                            image: base64Image,
                            senderId: user.uid,
                            type: "image",
                            text: `📍 Automated Location Snapshot (${isNoon ? 'Noon' : 'Midnight'})`,
                            createdAt: serverTimestamp()
                        });
                    }

                    // Mark as sent
                    await setDoc(summaryRef, {
                        [isNoon ? 'noonSnapshotSent' : 'midnightSnapshotSent']: true
                    }, { merge: true });

                    console.log("✅ Snapshot sent to caretakers.");
                }
            } catch (error) {
                console.error("Error capturing/sending snapshot:", error);
            }
        };

        const interval = setInterval(checkAndCaptureSnapshot, 60000); // Check every minute
        checkAndCaptureSnapshot(); // Run immediately on mount to check

        return () => clearInterval(interval);
    }, [user, location, requests]);

    // 3. Chat Functionality
    const [isRecording, setIsRecording] = useState(false);
    const [wasVoiceInput, setWasVoiceInput] = useState(false);
    const recognitionRef = useRef<any>(null);

    const startRecording = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("Your browser does not support voice input. Please use Chrome or Edge.");
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setIsRecording(true);
            setWasVoiceInput(true);
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setChatMessage(prev => prev + (prev ? " " : "") + transcript);
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsRecording(false);
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognition.start();
    };

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsRecording(false);
        }
    };

    const speakText = (text: string) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Stop any current speech
            const utterance = new SpeechSynthesisUtterance(text);
            window.speechSynthesis.speak(utterance);
        } else {
            alert("Text-to-speech not supported in this browser.");
        }
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !chatMessage.trim() || isChatLoading) return;

        const userMsg = chatMessage;
        // Capture the voice input state for this message
        const shouldSpeakResponse = wasVoiceInput;

        setChatMessage("");
        setWasVoiceInput(false); // Reset for next message
        setChatHistory(prev => [...prev, { role: "user", parts: userMsg }]);
        setIsChatLoading(true);

        try {
            // Prepare caretaker list for AI
            const caretakers = requests
                .filter(r => r.status === 'accepted')
                .map(r => ({ name: r.fromName, id: r.from }));

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMsg,
                    history: chatHistory,
                    caretakers: caretakers
                }),
            });

            const data = await response.json();

            if (data.text) {
                let aiResponse = data.text;

                // Check for COMMANDS
                const commandRegex = /<<<SEND_MESSAGE=(.*?)>>>/;
                const match = aiResponse.match(commandRegex);

                if (match) {
                    try {
                        const commandJson = JSON.parse(match[1]);
                        const { recipientId, message } = commandJson;

                        // Find the request to get the correct chat ID
                        const req = requests.find(r => r.from === recipientId && r.status === 'accepted');

                        if (req) {
                            const chatId = [user.uid, recipientId].sort().join("_");
                            await addDoc(collection(db, "chats", chatId, "messages"), {
                                text: `🤖 AI Assistant: ${message}`,
                                senderId: user.uid,
                                type: "text",
                                createdAt: serverTimestamp(),
                                isAutomated: true
                            });
                            console.log(`✅ AI sent message to ${req.fromName}`);
                        } else {
                            console.warn(`⚠ AI tried to message unknown/inactive caretaker: ${recipientId}`);
                        }

                        // Remove command from display
                        aiResponse = aiResponse.replace(match[0], "").trim();

                    } catch (cmdError) {
                        console.error("Failed to parse AI command:", cmdError);
                    }
                }

                setChatHistory(prev => [...prev, { role: "model", parts: aiResponse }]);

                // Auto-speak if the user used voice input
                if (shouldSpeakResponse) {
                    speakText(aiResponse);
                }
            } else {
                throw new Error(data.error || "Unknown error");
            }
        } catch (error: any) {
            console.error("Chat Error:", error);
            setChatHistory(prev => [...prev, {
                role: "model",
                parts: `⚠️ Error: ${error.message || "Could not connect"}. Please check your API Key.`
            }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory, isChatOpen]);

    const handleRequest = async (id: string, status: "accepted" | "rejected") => {
        await updateDoc(doc(db, "requests", id), { status });
    };

    return (
        <div className="p-6 max-w-md mx-auto pb-24">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Patient Dashboard</h1>
                    <p className="text-gray-500">CareConnect v1.0</p>
                </div>
                <div className="flex items-center space-x-4">
                    <a href="/download" className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-medium hover:bg-blue-100 transition-colors">
                        Get App
                    </a>
                    <button onClick={logout} className="text-sm text-red-600 hover:text-red-800 font-medium">
                        Logout
                    </button>
                </div>
            </div>

            {/* Status Card */}
            <div className={`p-6 rounded-2xl shadow-sm border mb-6 transition-all ${isSimulated ? "bg-orange-50 border-orange-100" : "bg-white border-gray-100"
                }`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <div className={`h-3 w-3 rounded-full mr-3 ${isSimulated ? "bg-orange-500 animate-pulse" : "bg-green-500 animate-pulse"
                            }`}></div>
                        <span className={`font-semibold ${isSimulated ? "text-orange-700" : "text-green-700"
                            }`}>
                            {locationStatus}
                        </span>
                    </div>
                    {isSimulated && <AlertTriangle className="h-5 w-5 text-orange-400" />}
                </div>

                {/* Manual Toggle */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200/50">
                    <span className="text-sm text-gray-600">Simulate Location</span>
                    <button
                        onClick={() => setManualSimulation(!manualSimulation)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${manualSimulation ? 'bg-blue-600' : 'bg-gray-200'
                            }`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${manualSimulation ? 'translate-x-6' : 'translate-x-1'
                            }`} />
                    </button>
                </div>

                <div className="mt-4 flex items-center text-gray-500 text-sm">
                    <MapPin className="h-4 w-4 mr-2" />
                    {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Locating..."}
                </div>
            </div>

            {/* Medicine Schedule */}
            {user && (
                <div className="mb-6">
                    <PatientMedicineView patientId={user.uid} />
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

            {/* Active Caretakers List */}
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
                                <p className="text-xs text-gray-500">{req.fromEmail}</p>
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setChatCaretaker(req)}
                                    className="bg-green-100 text-green-700 p-2 rounded-full hover:bg-green-200 transition-colors"
                                >
                                    <MessageCircle className="h-4 w-4" />
                                </button>
                                {/* Notification Dot */}
                                <div className="absolute -top-1 -right-1">
                                    <UnreadIndicator
                                        chatId={[user?.uid, req.from].sort().join("_")}
                                        currentUserId={user?.uid || ""}
                                    />
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
                    otherUserId={chatCaretaker.from} // Caretaker's UID
                    otherUserName={chatCaretaker.fromName}
                    onClose={() => setChatCaretaker(null)}
                    onCaptureSnapshot={async () => {
                        const mapElement = document.getElementById('map-container');
                        if (mapElement) {
                            try {
                                const canvas = await html2canvas(mapElement, { useCORS: true });
                                return canvas.toDataURL("image/png");
                            } catch (error) {
                                console.error("Error capturing snapshot:", error);
                                return null;
                            }
                        }
                        return null;
                    }}
                />
            )}

            {/* Hidden Map for Snapshot Purposes (or visible if desired) */}
            <div className="fixed top-0 left-0 -z-50 opacity-0 pointer-events-none" style={{ width: '800px', height: '600px' }}>
                {/* We render the map off-screen/hidden so we can capture it. 
                     Ideally, the patient should see it too, but for now we ensure it exists for the snapshot. 
                     Wait, if it's hidden with opacity 0, html2canvas might capture blank.
                     Better to put it in the UI properly. 
                 */}
            </div>

            {/* Actual Map Display - Adding it to the UI */}
            <div className="mb-6 h-64 rounded-xl overflow-hidden border border-gray-200 shadow-sm relative">
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

            {/* AI Chatbot */}
            <div className="fixed bottom-6 right-6 z-40">
                {!isChatOpen ? (
                    <button
                        onClick={() => setIsChatOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-xl transition-transform hover:scale-110 flex items-center justify-center"
                    >
                        <MessageCircle className="h-6 w-6" />
                    </button>
                ) : (
                    <div className="bg-white rounded-2xl shadow-2xl w-80 sm:w-96 flex flex-col border border-gray-200 overflow-hidden h-[500px]">
                        <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
                            <div className="flex items-center space-x-2">
                                <MessageCircle className="h-5 w-5" />
                                <span className="font-semibold">Health Assistant</span>
                            </div>
                            <button onClick={() => setIsChatOpen(false)} className="hover:bg-blue-700 p-1 rounded">
                                <Minimize2 className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4">
                            {chatHistory.length === 0 && (
                                <div className="text-center text-gray-500 text-sm mt-8">
                                    <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <MessageCircle className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <p>Hi! I'm CareConnect AI.</p>
                                    <p className="text-xs mt-1">Ask me anything about your health!</p>
                                </div>
                            )}
                            {chatHistory.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === "user"
                                        ? "bg-blue-600 text-white rounded-br-none"
                                        : "bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm"
                                        }`}>
                                        {msg.parts}
                                        {msg.role === "model" && (
                                            <button
                                                onClick={() => speakText(msg.parts)}
                                                className="ml-2 inline-block p-1 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                                                title="Read aloud"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-volume-2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isChatLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-gray-100 p-3 rounded-2xl rounded-bl-none">
                                        <div className="flex space-x-1">
                                            <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></div>
                                            <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                                            <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={chatEndRef} />
                        </div>

                        <form onSubmit={sendMessage} className="p-3 bg-white border-t border-gray-100 flex space-x-2">
                            <button
                                type="button"
                                onClick={isRecording ? stopRecording : startRecording}
                                className={`p-2 rounded-full transition-colors ${isRecording ? "bg-red-100 text-red-600 animate-pulse" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                                title={isRecording ? "Stop Recording" : "Start Recording"}
                            >
                                {isRecording ? (
                                    <div className="h-4 w-4 bg-red-600 rounded-sm" />
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mic"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
                                )}
                            </button>
                            <input
                                type="text"
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                placeholder={isRecording ? "Listening..." : "Type a message..."}
                                className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            />
                            <button
                                type="submit"
                                disabled={isChatLoading || !chatMessage.trim()}
                                className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                <SendIcon className="h-4 w-4" />
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
