"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, Minimize2, Send as SendIcon, Mic } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface AIChatBotProps {
    user: any; // User object from AuthAuth
    role: "patient" | "caretaker";
    targetPatientId: string; // The ID of the patient adding medicine for (Self or Managed)
    contextData?: any; // Extra data like list of caretakers or patient info
}

export default function AIChatBot({ user, role, targetPatientId, contextData }: AIChatBotProps) {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatMessage, setChatMessage] = useState("");
    const [chatHistory, setChatHistory] = useState<{ role: "user" | "model", parts: string }[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Voice State
    const [isRecording, setIsRecording] = useState(false);
    const [wasVoiceInput, setWasVoiceInput] = useState(false);
    const recognitionRef = useRef<any>(null);

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

        recognition.onstart = () => {
            setIsRecording(true);
            setWasVoiceInput(true);
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setChatMessage(prev => prev + (prev ? " " : "") + transcript);
        };

        recognition.onerror = (event: any) => {
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
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            window.speechSynthesis.speak(utterance);
        }
    };

    const handleCommands = async (aiResponse: string) => {
        let processedResponse = aiResponse;

        // 1. ADD_MEDICINE Command
        const addMedRegex = /<<<ADD_MEDICINE=(.*?)>>>/;
        const medMatch = processedResponse.match(addMedRegex);
        if (medMatch) {
            try {
                const medData = JSON.parse(medMatch[1]);
                if (targetPatientId) {
                    await addDoc(collection(db, "medicines"), {
                        patientId: targetPatientId,
                        patientName: role === "patient" ? user.displayName : (contextData?.patientName || "Patient"), // approximate
                        caretakerId: role === "caretaker" ? user.uid : null, // Optional tracking
                        name: medData.name,
                        dosage: medData.dosage,
                        times: medData.times,
                        instructions: medData.instructions || "",
                        active: true,
                        createdAt: serverTimestamp(),
                        source: "AI_COMMAND"
                    });
                    console.log("✅ Medicine added via AI");
                }
                processedResponse = processedResponse.replace(medMatch[0], "").trim();
            } catch (e) {
                console.error("Error parsing ADD_MEDICINE:", e);
            }
        }

        // 2. SEND_MESSAGE Command
        const sendMsgRegex = /<<<SEND_MESSAGE=(.*?)>>>/;
        const msgMatch = processedResponse.match(sendMsgRegex);
        if (msgMatch) {
            try {
                const msgData = JSON.parse(msgMatch[1]);
                const { recipientId, message } = msgData;

                // Only valid if I have a list of valid recipients (caretakers)
                // In Caretaker mode, sending message to PATIENT is also possible? 
                // Currently route.ts only thinks about messaging caretakers.
                // We'll stick to 'caretakers' prop for now.

                const validRecipient = contextData?.caretakers?.find((c: any) => c.id === recipientId);

                if (validRecipient) {
                    const chatId = [user.uid, recipientId].sort().join("_");
                    await addDoc(collection(db, "chats", chatId, "messages"), {
                        text: `🤖 AI Assistant: ${message}`,
                        senderId: user.uid,
                        type: "text",
                        createdAt: serverTimestamp(),
                        isAutomated: true
                    });
                    console.log(`✅ AI sent message to ${validRecipient.name}`);
                }
                processedResponse = processedResponse.replace(msgMatch[0], "").trim();
            } catch (e) {
                console.error("Error parsing SEND_MESSAGE:", e);
            }
        }

        return processedResponse;
    };

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !chatMessage.trim() || isChatLoading) return;

        const userMsg = chatMessage;
        const shouldSpeak = wasVoiceInput;
        setChatMessage("");
        setWasVoiceInput(false);
        setChatHistory(prev => [...prev, { role: "user", parts: userMsg }]);
        setIsChatLoading(true);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMsg,
                    history: chatHistory,
                    // If role is patient, pass caretakers. If caretaker, maybe pass patient info?
                    caretakers: contextData?.caretakers || []
                }),
            });

            const data = await response.json();
            if (data.text) {
                let aiText = data.text;
                aiText = await handleCommands(aiText);

                setChatHistory(prev => [...prev, { role: "model", parts: aiText }]);
                if (shouldSpeak) speakText(aiText);
            }
        } catch (error) {
            console.error(error);
            setChatHistory(prev => [...prev, { role: "model", parts: "Sorry, I encountered an error." }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    // Auto-scroll
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatHistory, isChatOpen]);

    return (
        <div className="fixed bottom-6 right-6 z-[5000]">
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
                                <p>Hi! I'm Guardian AI.</p>
                                <p className="text-xs mt-1">
                                    {role === 'patient'
                                        ? "Ask me to add medicines or contact your caretaker."
                                        : "Ask me to update the patient's schedule."}
                                </p>
                            </div>
                        )}
                        {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${msg.role === "user"
                                    ? "bg-blue-600 text-white rounded-br-none"
                                    : "bg-white border border-gray-200 text-gray-800 rounded-bl-none shadow-sm"
                                    }`}>
                                    {msg.parts}
                                </div>
                            </div>
                        ))}
                        {isChatLoading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 p-3 rounded-2xl rounded-bl-none">...</div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={sendMessage} className="p-3 bg-white border-t border-gray-100 flex space-x-2">
                        <button
                            type="button"
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`p-2 rounded-full transition-colors ${isRecording ? "bg-red-100 text-red-600 animate-pulse" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                            <Mic className="h-4 w-4" />
                        </button>
                        <input
                            type="text"
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900"
                        />
                        <button type="submit" disabled={isChatLoading || !chatMessage.trim()} className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700">
                            <SendIcon className="h-4 w-4" />
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
