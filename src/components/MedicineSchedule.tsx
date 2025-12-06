// Medicine Schedule Component for Caretakers
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Pill, Plus, Trash2, Edit2, Clock, X } from "lucide-react";

interface MedicineScheduleProps {
    patientId: string;
    patientName: string;
    caretakerId: string;
    onClose: () => void;
}

interface Medicine {
    id: string;
    name: string;
    dosage: string;
    times: string[];
    instructions: string;
    active: boolean;
}

export default function MedicineSchedule({ patientId, patientName, caretakerId, onClose }: MedicineScheduleProps) {
    const [medicines, setMedicines] = useState<Medicine[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);

    // Form state
    const [medicineName, setMedicineName] = useState("");
    const [dosage, setDosage] = useState("");
    const [times, setTimes] = useState<string[]>([""]);
    const [instructions, setInstructions] = useState("");

    useEffect(() => {
        const q = query(
            collection(db, "medicines"),
            where("patientId", "==", patientId),
            where("caretakerId", "==", caretakerId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMedicines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Medicine)));
        });

        return () => unsubscribe();
    }, [patientId, caretakerId]);

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
            alert("Please fill in all required fields");
            return;
        }

        try {
            if (editingMedicine) {
                // Update existing medicine
                await updateDoc(doc(db, "medicines", editingMedicine.id), {
                    name: medicineName,
                    dosage,
                    times: validTimes,
                    instructions,
                    updatedAt: serverTimestamp()
                });
            } else {
                // Add new medicine
                await addDoc(collection(db, "medicines"), {
                    patientId,
                    patientName,
                    caretakerId,
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
            alert("Failed to save medicine schedule");
        }
    };

    const handleEdit = (medicine: Medicine) => {
        setEditingMedicine(medicine);
        setMedicineName(medicine.name);
        setDosage(medicine.dosage);
        setTimes(medicine.times);
        setInstructions(medicine.instructions || "");
        setShowForm(true);
    };

    const handleDelete = async (medicineId: string) => {
        if (confirm("Are you sure you want to delete this medicine schedule?")) {
            try {
                await deleteDoc(doc(db, "medicines", medicineId));
            } catch (error) {
                console.error("Error deleting medicine:", error);
            }
        }
    };

    const addTimeSlot = () => {
        setTimes([...times, ""]);
    };

    const updateTimeSlot = (index: number, value: string) => {
        const newTimes = [...times];
        newTimes[index] = value;
        setTimes(newTimes);
    };

    const removeTimeSlot = (index: number) => {
        setTimes(times.filter((_, i) => i !== index));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 flex justify-between items-center text-white">
                    <div className="flex items-center space-x-3">
                        <Pill className="h-6 w-6" />
                        <div>
                            <h2 className="text-xl font-bold">Medicine Schedule</h2>
                            <p className="text-sm text-purple-100">{patientName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-lg transition-colors">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!showForm ? (
                        <>
                            {/* Medicine List */}
                            <div className="space-y-4">
                                {medicines.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400">
                                        <Pill className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                        <p>No medicines scheduled yet</p>
                                        <p className="text-sm">Click "Add Medicine" to create a schedule</p>
                                    </div>
                                ) : (
                                    medicines.map((medicine) => (
                                        <div key={medicine.id} className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-xl border border-purple-100">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className="font-bold text-lg text-gray-900">{medicine.name}</h3>
                                                    <p className="text-sm text-gray-600">{medicine.dosage}</p>
                                                </div>
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => handleEdit(medicine)}
                                                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                                                    >
                                                        <Edit2 className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(medicine.id)}
                                                        className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                {medicine.times.map((time, idx) => (
                                                    <div key={idx} className="flex items-center bg-white px-3 py-1 rounded-full text-sm font-medium text-purple-700 border border-purple-200">
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        {time}
                                                    </div>
                                                ))}
                                            </div>
                                            {medicine.instructions && (
                                                <p className="text-sm text-gray-600 italic mt-2">
                                                    📝 {medicine.instructions}
                                                </p>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Add Button */}
                            <button
                                onClick={() => setShowForm(true)}
                                className="w-full mt-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center space-x-2"
                            >
                                <Plus className="h-5 w-5" />
                                <span>Add Medicine</span>
                            </button>
                        </>
                    ) : (
                        /* Medicine Form */
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Medicine Name *
                                </label>
                                <input
                                    type="text"
                                    value={medicineName}
                                    onChange={(e) => setMedicineName(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                    placeholder="e.g., Aspirin"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Dosage *
                                </label>
                                <input
                                    type="text"
                                    value={dosage}
                                    onChange={(e) => setDosage(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                    placeholder="e.g., 1 tablet, 5ml"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Times *
                                </label>
                                {times.map((time, index) => (
                                    <div key={index} className="flex space-x-2 mb-2">
                                        <input
                                            type="time"
                                            value={time}
                                            onChange={(e) => updateTimeSlot(index, e.target.value)}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                            required
                                        />
                                        {times.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeTimeSlot(index)}
                                                className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addTimeSlot}
                                    className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center space-x-1"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Add another time</span>
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Instructions (Optional)
                                </label>
                                <textarea
                                    value={instructions}
                                    onChange={(e) => setInstructions(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                    placeholder="e.g., Take with food, Before bed"
                                    rows={3}
                                />
                            </div>

                            <div className="flex space-x-3 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all"
                                >
                                    {editingMedicine ? "Update Medicine" : "Save Medicine"}
                                </button>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
