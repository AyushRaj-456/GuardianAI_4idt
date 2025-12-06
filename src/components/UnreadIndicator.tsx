"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

interface UnreadIndicatorProps {
    chatId: string;
    currentUserId: string;
}

export default function UnreadIndicator({ chatId, currentUserId }: UnreadIndicatorProps) {
    const [hasUnread, setHasUnread] = useState(false);

    useEffect(() => {
        if (!chatId || !currentUserId) return;

        const q = query(
            collection(db, "chats", chatId, "messages"),
            orderBy("createdAt", "desc"),
            limit(1)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const lastMsg = snapshot.docs[0].data();
                // Simple logic: If the last message wasn't sent by me, show dot.
                // In a real app, we'd check a 'readBy' array or 'lastReadTime'.
                if (lastMsg.senderId !== currentUserId) {
                    setHasUnread(true);
                } else {
                    setHasUnread(false);
                }
            }
        });

        return () => unsubscribe();
    }, [chatId, currentUserId]);

    if (!hasUnread) return null;

    return (
        <div className="h-3 w-3 bg-red-500 rounded-full border-2 border-white shadow-sm animate-pulse"></div>
    );
}
