"use client";

import { Download, Shield, Smartphone, AlertTriangle } from "lucide-react";

export default function DownloadPage() {
    return (
        <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-blue-600 p-6 text-center text-white">
                    <Smartphone className="h-12 w-12 mx-auto mb-2" />
                    <h1 className="text-2xl font-bold">Download Guardian AI App</h1>

                    <p className="text-blue-100">For Android Devices</p>
                </div>

                <div className="p-6 space-y-6">
                    {/* Download Button */}
                    <div className="text-center">
                        <a
                            href="/GuardianAI.apk"
                            download
                            className="inline-flex items-center justify-center w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform transition hover:scale-105"
                        >
                            <Download className="h-6 w-6 mr-2" />
                            Download GuardianAI
                        </a>
                        <p className="text-xs text-gray-400 mt-2">Version 1.1 • 5.5 MB</p>
                    </div>

                    <div className="border-t border-gray-100 pt-4">
                        <h2 className="font-semibold text-gray-800 mb-4 flex items-center">
                            <Shield className="h-5 w-5 mr-2 text-blue-600" />
                            How to Install
                        </h2>

                        <div className="space-y-4">
                            <div className="flex">
                                <div className="flex-shrink-0 h-8 w-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm mr-3">1</div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Download the file</p>
                                    <p className="text-xs text-gray-500">Click the button above. You may see a warning that the file might be harmful. This is normal for apps not on the Play Store.</p>
                                </div>
                            </div>

                            <div className="flex">
                                <div className="flex-shrink-0 h-8 w-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm mr-3">2</div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Open the APK</p>
                                    <p className="text-xs text-gray-500">Tap on the downloaded file in your notification bar or Downloads folder.</p>
                                </div>
                            </div>

                            <div className="flex">
                                <div className="flex-shrink-0 h-8 w-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm mr-3">3</div>
                                <div>
                                    <p className="text-sm font-medium text-gray-900">Allow Unknown Sources</p>
                                    <p className="text-xs text-gray-500">If prompted, go to Settings and enable "Install unknown apps" for your browser.</p>
                                </div>
                            </div>

                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 flex items-start">
                                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0" />
                                <p className="text-xs text-yellow-800">
                                    <strong>Note:</strong> If you see a "Blocked by Play Protect" warning, tap "More Details" and then "Install Anyway". This app is safe but not verified by Google yet.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
                    <a href="/" className="text-sm text-blue-600 font-medium hover:underline">Back to Dashboard</a>
                </div>
            </div>
        </div>
    );
}
