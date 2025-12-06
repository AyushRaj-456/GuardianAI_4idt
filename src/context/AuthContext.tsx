"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

type UserRole = "patient" | "caretaker" | null;

interface AuthContextType {
    user: User | null;
    role: UserRole;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    assignRole: (role: "patient" | "caretaker") => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    role: null,
    loading: true,
    signInWithGoogle: async () => { },
    logout: async () => { },
    assignRole: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<UserRole>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Fetch role from Firestore
                const userDoc = await getDoc(doc(db, "users", currentUser.uid));
                if (userDoc.exists()) {
                    setRole(userDoc.data().role as UserRole);
                } else {
                    setRole(null); // New user, needs to select role
                }
            } else {
                setRole(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            // Navigation will be handled by the component or effect based on role
        } catch (error) {
            console.error("Error signing in with Google", error);
        }
    };

    const logout = async () => {
        await signOut(auth);
        setRole(null);
        router.push("/");
    };

    const assignRole = async (selectedRole: "patient" | "caretaker") => {
        if (!user) return;

        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            name: user.displayName,
            role: selectedRole,
            createdAt: new Date().toISOString(),
        }, { merge: true });

        setRole(selectedRole);
    };

    return (
        <AuthContext.Provider value={{ user, role, loading, signInWithGoogle, logout, assignRole }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
