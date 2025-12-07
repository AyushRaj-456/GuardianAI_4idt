"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Mic, AlertTriangle, ImageIcon, User, Bot, Plus, MessageSquare, Trash2, Menu, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, deleteDoc, updateDoc } from "firebase/firestore";

interface HealthAdvisorProps {
    user: any;
    role: "patient" | "caretaker";
    contextData?: any;
    onClose?: () => void;
}

export default function HealthAdvisorView({ user, role, contextData, onClose }: HealthAdvisorProps) {
    // Session State
    const [sessions, setSessions] = useState<any[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile sidebar toggle
    const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true); // Desktop sidebar toggle

    // Chat State
    const [chatMessage, setChatMessage] = useState("");
    const [chatHistory, setChatHistory] = useState<any[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Voice State
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);

    // 1. Subscribe to List of Chat Sessions
    useEffect(() => {
        if (!user) return;
        const q = query(
            collection(db, "health_chats"),
            where("userId", "==", user.uid),
            orderBy("lastModified", "desc")
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSessions(sessionsData);
        });
        return () => unsubscribe();
    }, [user]);

    // 2. Subscribe to Messages of Current Session
    useEffect(() => {
        if (!currentSessionId) {
            setChatHistory([]);
            return;
        }

        const q = query(
            collection(db, "health_chats", currentSessionId, "messages"),
            orderBy("createdAt", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setChatHistory(msgs);
            // Scroll to bottom on new message
            setTimeout(() => {
                chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        });

        return () => unsubscribe();
    }, [currentSessionId]);

    const createNewChat = () => {
        setCurrentSessionId(null);
        setChatHistory([]);
        setIsSidebarOpen(false);
    };

    const deleteSession = async (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        if (!confirm("Delete this chat?")) return;

        try {
            await deleteDoc(doc(db, "health_chats", sessionId));
            if (currentSessionId === sessionId) {
                setCurrentSessionId(null);
            }
        } catch (error) {
            console.error("Error deleting chat:", error);
        }
    };

    const startRecording = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("Your browser does not support voice input.");
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsRecording(true);
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setChatMessage(prev => prev + (prev ? " " : "") + transcript);
        };
        recognition.onend = () => setIsRecording(false);
        recognition.onerror = () => setIsRecording(false);

        recognition.start();
    };

    const stopRecording = () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleCommands = (aiResponse: string) => {
        let processedResponse = aiResponse;
        const extraMessages: any[] = [];

        // Improved Regex for VISUALIZE
        const visualizeRegex = /<<<VISUALIZE=(.*?)>>>/gi;
        let match;

        while ((match = visualizeRegex.exec(aiResponse)) !== null) {
            const prompt = match[1];
            console.log("🎨 Visualizing:", prompt);

            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=600&nologo=true`;

            extraMessages.push({
                role: "model",
                parts: imageUrl,
                type: "image",
                createdAt: serverTimestamp()
            });

            processedResponse = processedResponse.replace(match[0], "");
        }

        return { text: processedResponse.trim(), extraMessages };
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !chatMessage.trim() || isChatLoading) return;

        const userMsg = chatMessage;
        setChatMessage("");
        setIsChatLoading(true);

        try {
            let sessionId = currentSessionId;

            // 1. Create Session if needed
            if (!sessionId) {
                const sessionRef = await addDoc(collection(db, "health_chats"), {
                    userId: user.uid,
                    role: role,
                    title: userMsg.slice(0, 30) + (userMsg.length > 30 ? "..." : ""),
                    createdAt: serverTimestamp(),
                    lastModified: serverTimestamp()
                });
                sessionId = sessionRef.id;
                setCurrentSessionId(sessionId);
            } else {
                await updateDoc(doc(db, "health_chats", sessionId), {
                    lastModified: serverTimestamp()
                });
            }

            // 2. Add User Message
            const historyForApi = chatHistory
                .filter(msg => msg.type !== "image")
                .map(msg => ({ role: msg.role, parts: msg.parts }));

            await addDoc(collection(db, "health_chats", sessionId, "messages"), {
                role: "user",
                parts: userMsg,
                type: "text",
                createdAt: serverTimestamp()
            });

            // 3. Call API
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMsg,
                    history: historyForApi,
                    caretakers: contextData?.caretakers || []
                }),
            });

            const data = await response.json();

            if (data.text) {
                const { text, extraMessages } = handleCommands(data.text);

                if (text) {
                    await addDoc(collection(db, "health_chats", sessionId!, "messages"), {
                        role: "model",
                        parts: text,
                        type: "text",
                        createdAt: serverTimestamp()
                    });
                }

                for (const imgMsg of extraMessages) {
                    await addDoc(collection(db, "health_chats", sessionId!, "messages"), {
                        role: "model",
                        parts: imgMsg.parts,
                        type: "image",
                        createdAt: serverTimestamp()
                    });
                }
            } else if (data.error) {
                throw new Error(data.error);
            }

        } catch (error: any) {
            console.error(error);
        } finally {
            setIsChatLoading(false);
        }
    };

    return (
        <div className="flex h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">

            {/* Sidebar */}
            <div className={`
                absolute md:relative z-20 h-full bg-gray-50 border-r border-gray-100 transform transition-all duration-300 ease-in-out flex flex-col
                ${isSidebarOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0"}
                ${isDesktopSidebarOpen ? "md:w-64" : "md:w-0 md:border-r-0 md:overflow-hidden"}
            `}>
                <div className="p-4 border-b border-gray-200 flex justify-between items-center min-w-[16rem]">
                    <button
                        onClick={createNewChat}
                        className="flex-1 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center hover:bg-teal-700 transition-colors"
                    >
                        <Plus className="h-4 w-4 mr-2" /> New Chat
                    </button>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden ml-2 p-1 text-gray-500">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1 min-w-[16rem]">
                    {sessions.length === 0 && (
                        <p className="text-center text-xs text-gray-400 mt-4">No past chats</p>
                    )}
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => { setCurrentSessionId(session.id); setIsSidebarOpen(false); }}
                            className={`
                                group flex items-center justify-between p-3 rounded-lg cursor-pointer text-sm mb-1 transition-all
                                ${currentSessionId === session.id ? "bg-white shadow-sm border border-gray-200" : "hover:bg-gray-100 text-gray-600"}
                            `}
                        >
                            <div className="flex items-center overflow-hidden">
                                <MessageSquare className={`h-4 w-4 mr-2 flex-shrink-0 ${currentSessionId === session.id ? "text-teal-600" : "text-gray-400"}`} />
                                <span className="truncate font-medium">{session.title || "New Chat"}</span>
                            </div>
                            <button
                                onClick={(e) => deleteSession(e, session.id)}
                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1"
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col h-full relative">

                {/* Header */}
                <div className="bg-gradient-to-r from-teal-600 to-teal-700 p-4 text-white flex justify-between items-center shrink-0 z-10 shadow-sm">
                    <div className="flex items-center">
                        <button onClick={() => setIsSidebarOpen(true)} className="mr-3 md:hidden p-1 rounded hover:bg-white/10">
                            <Menu className="h-5 w-5" />
                        </button>

                        <button
                            onClick={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)}
                            className="mr-3 hidden md:flex p-1.5 rounded hover:bg-white/10 transition-colors"
                            title={isDesktopSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
                        >
                            <Menu className="h-5 w-5" />
                        </button>

                        <div className="flex flex-col">
                            <h2 className="text-lg font-bold flex items-center">
                                <Bot className="h-5 w-5 mr-2" />
                                AI Health Advisor
                            </h2>
                            <p className="text-[10px] text-teal-100 opacity-90 flex items-center mt-0.5">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Medical advice generated by AI. Consult a professional.
                            </p>
                        </div>
                    </div>
                    {onClose && (
                        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>

                {/* Messages */}
                <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-gray-50/50">
                    {!currentSessionId && chatHistory.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-4/5 text-gray-400 text-center animate-in fade-in zoom-in duration-300">
                            <div className="bg-teal-100 w-24 h-24 rounded-full flex items-center justify-center mb-6">
                                <ImageIcon className="h-10 w-10 text-teal-600" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">Visual Health Assistant</h3>
                            <p className="max-w-md text-sm mb-8">
                                Ask about symptoms, remedies, or health tips.<br />
                                I can <b>visualize</b> treatments for you.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg px-4">
                                <button onClick={() => setChatMessage("Show me a healthy plate")} className="p-3 bg-white border border-gray-200 rounded-xl text-sm hover:shadow-md hover:border-teal-200 transition-all text-left flex items-center">
                                    🥗 "Show me a healthy plate"
                                </button>
                                <button onClick={() => setChatMessage("Yoga for back pain?")} className="p-3 bg-white border border-gray-200 rounded-xl text-sm hover:shadow-md hover:border-teal-200 transition-all text-left flex items-center">
                                    🧘‍♀️ "Yoga for back pain?"
                                </button>
                            </div>
                        </div>
                    )}

                    {chatHistory.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`flex max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                                <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mx-2 ${msg.role === "user" ? "bg-blue-100 text-blue-600" : "bg-teal-100 text-teal-600"}`}>
                                    {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                </div>

                                <div className={`p-4 rounded-2xl text-sm shadow-sm ${msg.role === "user"
                                        ? "bg-blue-600 text-white rounded-tr-none"
                                        : "bg-white border border-gray-200 text-gray-800 rounded-tl-none"
                                    }`}>
                                    {msg.type === "image" ? (
                                        <div className="space-y-2">
                                            <p className="text-xs opacity-70 mb-1">Generated Visualization:</p>
                                            <img
                                                src={msg.parts}
                                                alt="AI Visual"
                                                className="rounded-lg w-full max-h-72 object-cover border border-gray-200 bg-gray-100 min-h-[150px]"
                                                loading="lazy"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Image+Load+Error';
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.parts}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isChatLoading && (
                        <div className="flex justify-start">
                            <div className="flex flex-row items-center ml-12">
                                <div className="flex space-x-1 bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm">
                                    <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <form onSubmit={sendMessage} className="p-4 bg-white border-t border-gray-100 flex items-center gap-3 shrink-0 z-10">
                    <button
                        type="button"
                        onClick={isRecording ? stopRecording : startRecording}
                        className={`p-3 rounded-full transition-all ${isRecording ? "bg-red-100 text-red-600 animate-pulse scale-110" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                    >
                        <Mic className="h-5 w-5" />
                    </button>
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            placeholder="Type your health query..."
                            className="w-full px-5 py-3 pr-12 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-gray-800"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isChatLoading || !chatMessage.trim()}
                        className="p-3 bg-teal-600 text-white rounded-full hover:bg-teal-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center"
                    >
                        <Send className="h-5 w-5 ml-0.5" />
                    </button>
                </form>
            </div>
        </div>
    );
}
