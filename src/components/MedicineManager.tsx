"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Pill, Plus, Trash2, Edit2, Clock, X, AlertCircle } from "lucide-react";

interface MedicineManagerProps {
    patientId: string;
    patientName: string; // Used for display or metadata
    currentUserRole: "patient" | "caretaker";
    currentUserId: string;
    onClose: () => void;
}

interface Medicine {
    id: string;
    name: string;
    dosage: string;
    times: string[]; // ["08:00", "20:00"]
    instructions: string;
    active: boolean;
}

export default function MedicineManager({ patientId, patientName, currentUserRole, currentUserId, onClose }: MedicineManagerProps) {
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);

    // Form state
    const [medicineName, setMedicineName] = useState("");
    const [dosage, setDosage] = useState("");
    const [times, setTimes] = useState<string[]>([""]);
    const [instructions, setInstructions] = useState("");

    // Fetch ALL medicines for this patient, regardless of who created them
    useEffect(() => {
        const q = query(
            collection(db, "medicines"),
            where("patientId", "==", patientId),
            where("active", "==", true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMedicines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Medicine)));
        });

        return () => unsubscribe();
    }, [patientId]);

    const resetForm = () => {
        setMedicineName("");
        setDosage("");
        setTimes([""]);
        setInstructions("");
        setEditingMedicine(null);
        setShowForm(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const validTimes = times.filter(t => t.trim() !== "");
        if (!medicineName || !dosage || validTimes.length === 0) {
            alert("Please fill in all required fields (Name, Dosage, at least one Time).");
            return;
        }

        try {
            if (editingMedicine) {
                // Update
                await updateDoc(doc(db, "medicines", editingMedicine.id), {
                    name: medicineName,
                    dosage,
                    times: validTimes,
                    instructions,
                    updatedAt: serverTimestamp(),
                    lastModifiedBy: currentUserId
                });
            } else {
                // Create
                await addDoc(collection(db, "medicines"), {
                    patientId,
                    patientName,
                    caretakerId: currentUserRole === "caretaker" ? currentUserId : null,
                    createdBy: currentUserId,
                    name: medicineName,
                    dosage,
                    times: validTimes,
                    instructions,
                    active: true,
                    createdAt: serverTimestamp()
                });
            }
            resetForm();
        } catch (error) {
            console.error("Error saving medicine:", error);
            alert("Failed to save schedule.");
        }
    };

    const handleEdit = (medicine: Medicine) => {
        setEditingMedicine(medicine);
        setMedicineName(medicine.name);
        setDosage(medicine.dosage);
        setTimes(medicine.times || [""]);
        setInstructions(medicine.instructions || "");
        setShowForm(true);
    };

    const handleDelete = async (medicineId: string) => {
        if (confirm("Delete this medicine schedule?")) {
            await deleteDoc(doc(db, "medicines", medicineId));
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-fadeIn">
                {/* Header */}
                <div className="bg-gradient-to-r from-teal-500 to-emerald-600 p-6 flex justify-between items-center text-white">
                    <div className="flex items-center space-x-3">
                        <Pill className="h-6 w-6" />
                        <div>
                            <h2 className="text-xl font-bold">Medicine Cabinet</h2>
                            <p className="text-sm text-teal-100">Managing for: {patientName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {!showForm ? (
                        <div className="space-y-6">
                            {medicines.length === 0 ? (
                                <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                                    <Pill className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p>No medicines in the cabinet.</p>
                                    <button
                                        onClick={() => setShowForm(true)}
                                        className="mt-4 text-teal-600 font-bold hover:underline"
                                    >
                                        Add your first medicine
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {medicines.map((medicine) => (
                                        <div key={medicine.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-lg text-gray-900">{medicine.name}</h3>
                                                    <div className="flex items-center text-sm text-gray-500 mt-1">
                                                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-medium text-xs uppercase tracking-wide mr-2">
                                                            {medicine.dosage}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex space-x-2">
                                                    <button onClick={() => handleEdit(medicine)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(medicine.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-4 flex flex-wrap gap-2">
                                                {medicine.times.map((time, idx) => (
                                                    <div key={idx} className="flex items-center bg-gray-100 px-3 py-1.5 rounded-full text-xs font-bold text-gray-600">
                                                        <Clock className="h-3 w-3 mr-1.5" />
                                                        {time}
                                                    </div>
                                                ))}
                                            </div>

                                            {medicine.instructions && (
                                                <div className="mt-3 flex items-start text-sm text-gray-500 bg-yellow-50 p-2 rounded-lg border border-yellow-100">
                                                    <AlertCircle className="h-4 w-4 mr-2 text-yellow-600 mt-0.5" />
                                                    {medicine.instructions}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button
                                onClick={() => setShowForm(true)}
                                className="w-full bg-white border-2 border-teal-500 text-teal-600 border-dashed py-3 rounded-xl font-bold hover:bg-teal-50 transition-colors flex items-center justify-center space-x-2"
                            >
                                <Plus className="h-5 w-5" />
                                <span>Add New Medicine</span>
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-5">
                            <h3 className="font-bold text-gray-900 text-lg border-b pb-2 mb-4">
                                {editingMedicine ? "Edit Medicine" : "Add New Medicine"}
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Medicine Name</label>
                                    <input
                                        type="text"
                                        value={medicineName}
                                        onChange={(e) => setMedicineName(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                                        placeholder="e.g. Metformin"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Dosage</label>
                                    <input
                                        type="text"
                                        value={dosage}
                                        onChange={(e) => setDosage(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                                        placeholder="e.g. 500mg"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Schedule Times</label>
                                <div className="space-y-2">
                                    {times.map((time, index) => (
                                        <div key={index} className="flex space-x-2">
                                            <input
                                                type="time"
                                                value={time}
                                                onChange={(e) => {
                                                    const newTimes = [...times];
                                                    newTimes[index] = e.target.value;
                                                    setTimes(newTimes);
                                                }}
                                                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                                                required
                                            />
                                            {times.length > 1 && (
                                                <button type="button" onClick={() => setTimes(times.filter((_, i) => i !== index))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button type="button" onClick={() => setTimes([...times, ""])} className="text-sm text-teal-600 font-semibold hover:underline flex items-center">
                                        <Plus className="h-3 w-3 mr-1" /> Add Time
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Instructions</label>
                                <textarea
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                                    placeholder="Examples: Before food, with water, do not crush..."
                                    rows={2}
                                />
                            </div>

                            <div className="flex space-x-3 pt-4 border-t mt-4">
                                <button type="button" onClick={resetForm} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-1 px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-colors shadow-lg shadow-teal-200">
                                    Save Schedule
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
