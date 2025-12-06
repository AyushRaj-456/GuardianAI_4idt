"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import PatientView from "@/components/PatientView";
import CaretakerView from "@/components/CaretakerView";
import { User, HeartHandshake } from "lucide-react";

export default function Dashboard() {
    const { user, role, loading, assignRole } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push("/");
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!user) return null;

    if (!role) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
                <div className="max-w-2xl w-full text-center space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Welcome to CareConnect</h1>
                        <p className="text-gray-500 mt-2">Please select your role to continue</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <button
                            onClick={() => assignRole("patient")}
                            className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-md hover:shadow-xl transition-all border-2 border-transparent hover:border-blue-500 group"
                        >
                            <div className="h-20 w-20 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                                <User className="h-10 w-10 text-blue-600" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900">I am a Patient</h2>
                            <p className="text-gray-500 mt-2 text-sm">
                                I want to share my status and stay safe.
                            </p>
                        </button>

                        <button
                            onClick={() => assignRole("caretaker")}
                            className="flex flex-col items-center p-8 bg-white rounded-2xl shadow-md hover:shadow-xl transition-all border-2 border-transparent hover:border-green-500 group"
                        >
                            <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                                <HeartHandshake className="h-10 w-10 text-green-600" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900">I am a Caretaker</h2>
                            <p className="text-gray-500 mt-2 text-sm">
                                I want to monitor and support my loved ones.
                            </p>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return role === "patient" ? <PatientView /> : <CaretakerView />;
}
