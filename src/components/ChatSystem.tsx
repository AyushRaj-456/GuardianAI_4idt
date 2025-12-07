"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, getDocs, writeBatch, doc } from "firebase/firestore";
import { Send, Mic, Square, Play, Pause, MessageCircle, X, Trash2 } from "lucide-react";

interface ChatSystemProps {
    currentUserId: string;
    otherUserId: string;
    otherUserName: string;
    onClose: () => void;
    onCaptureSnapshot?: () => Promise<string | null>;
}

export default function ChatSystem({ currentUserId, otherUserId, otherUserName, onClose, onCaptureSnapshot }: ChatSystemProps) {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Generate a unique chat ID based on the two user IDs (sorted to ensure consistency)
    const chatId = [currentUserId, otherUserId].sort().join("_");

    useEffect(() => {
        const q = query(
            collection(db, "chats", chatId, "messages"),
            orderBy("createdAt", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            scrollToBottom();
        });

        return () => unsubscribe();
    }, [chatId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const sendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            await addDoc(collection(db, "chats", chatId, "messages"), {
                text: newMessage,
                senderId: currentUserId,
                type: "text",
                createdAt: serverTimestamp()
            });
            setNewMessage("");
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const clearChat = async () => {
        if (!confirm("Are you sure you want to clear all messages in this chat? This action cannot be undone.")) {
            return;
        }

        try {
            const q = query(collection(db, "chats", chatId, "messages"));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                return;
            }

            const batch = writeBatch(db);
            snapshot.docs.forEach((document) => {
                batch.delete(doc(db, "chats", chatId, "messages", document.id));
            });

            await batch.commit();
        } catch (error) {
            console.error("Error clearing chat:", error);
            alert("Failed to clear chat. Please try again.");
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                await sendVoiceMessage(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("Could not access microphone. Please allow permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const sendVoiceMessage = async (audioBlob: Blob) => {
        // Convert Blob to Base64 for simple Firestore storage (Prototype only)
        // In production, upload to Firebase Storage and save URL
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64Audio = reader.result;
            try {
                await addDoc(collection(db, "chats", chatId, "messages"), {
                    audio: base64Audio,
                    senderId: currentUserId,
                    type: "audio",
                    createdAt: serverTimestamp()
                });
            } catch (error) {
                console.error("Error sending voice message:", error);
            }
        };
    };

    const sendImageMessage = async (base64Image: string) => {
        try {
            await addDoc(collection(db, "chats", chatId, "messages"), {
                image: base64Image,
                senderId: currentUserId,
                type: "image",
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error sending image message:", error);
        }
    };

    // Timer for recording
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isRecording) {
            interval = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "";
        if (typeof timestamp.toDate === "function") {
            return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        if (timestamp instanceof Date) {
            return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        if (typeof timestamp === "string") {
            return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return "";
    };

    return (
        <div className="fixed bottom-4 right-4 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col h-[500px] z-[9999]">
            {/* Header */}
            <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
                <div className="flex items-center space-x-2">
                    <MessageCircle className="h-5 w-5" />
                    <span className="font-semibold truncate">{otherUserName}</span>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={clearChat}
                        className="hover:bg-blue-700 p-1 rounded transition-colors"
                        title="Clear chat"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                    <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-gray-400 text-sm mt-10">
                        No messages yet. Say hi! 👋
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.senderId === currentUserId ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.senderId === currentUserId
                            ? "bg-blue-600 text-white rounded-br-none"
                            : "bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm"
                            }`}>
                            {msg.type === "audio" && msg.audio ? (
                                <div className="flex items-center space-x-2">
                                    <audio controls src={msg.audio} className="h-8 w-48" />
                                </div>
                            ) : msg.type === "image" && msg.image ? (
                                <div>
                                    <img src={msg.image} alt="Snapshot" className="rounded-lg max-w-full h-auto border border-gray-200" />
                                </div>
                            ) : (
                                <p>{msg.text}</p>
                            )}
                            <p className={`text-[10px] mt-1 text-right ${msg.senderId === currentUserId ? "text-blue-100" : "text-gray-400"}`}>
                                {formatDate(msg.createdAt)}
                            </p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-gray-100">
                {isRecording ? (
                    <div className="flex items-center justify-between bg-red-50 p-2 rounded-full px-4 border border-red-100 animate-pulse">
                        <div className="flex items-center text-red-600 font-medium text-sm">
                            <div className="h-2 w-2 bg-red-600 rounded-full mr-2 animate-bounce"></div>
                            Recording {formatTime(recordingTime)}
                        </div>
                        <button
                            onClick={stopRecording}
                            className="bg-red-600 text-white p-1.5 rounded-full hover:bg-red-700 transition-colors"
                        >
                            <Square className="h-4 w-4 fill-current" />
                        </button>
                    </div>
                ) : (
                    <form onSubmit={sendMessage} className="flex space-x-2">
                        {onCaptureSnapshot && (
                            <button
                                type="button"
                                onClick={async () => {
                                    const snapshot = await onCaptureSnapshot();
                                    if (snapshot) {
                                        sendImageMessage(snapshot);
                                    }
                                }}
                                className="bg-gray-100 text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors"
                                title="Send Map Snapshot"
                            >
                                📍
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={startRecording}
                            className="bg-gray-100 text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors"
                            title="Record Voice Message"
                        >
                            <Mic className="h-5 w-5" />
                        </button>
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm text-gray-900"
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim()}
                            className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send className="h-4 w-4" />
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
