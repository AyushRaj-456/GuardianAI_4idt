# GuardianAI: Technical Feature Report

## 1. Introduction
**GuardianAI** is a comprehensive patient monitoring and assistance platform designed specifically for patients suffering from dementia or Alzheimer's, and their caretakers. The platform serves as a digital bridge, ensuring patient safety, medical adherence, and 24/7 health assistance while giving caretakers peace of mind through real-time monitoring tools.

---

## 2. Core Features & Problem Solving

### 2.1. AI Health Advisor (The "Brain")
**Problem**: Patients often have repetitive health questions, need reassurance, or struggle to understand medical instructions. Caretakers cannot be available every second.
**Solution**: An always-on, empathetic AI companion that answers health queries and visualizes advice.

*   **How it Works**:
    *   **AI Engine**: Powered by **Llama 3.3 (70B parameter model)** via the **Groq API**. This ensures lightning-fast, human-like responses.
    *   **Visualization**: Uses **Pollinations.ai** to generate real-time images for remedies (e.g., "Show me a healthy plate"). This is crucial for dementia patients who respond better to visual cues.
    *   **Memory**: The system uses **Firebase Firestore** to maintain a persistent chat history, allowing the AI to "remember" past conversations and context.
    *   **Voice Interface**: Features text-to-speech and speech-to-text for accessibility.

### 2.2. Real-Time Geolocation Tracking
**Problem**: "Wandering" is a dangerous symptom of dementia. Patients may leave their safe zone and get lost.
**Solution**: A live tracking system that updates the patient's location every few seconds.

*   **How it Works**:
    *   **Tracking**: The generic PWA (Progressive Web App) or Android App uses the device's GPS (`navigator.geolocation`) to capture coordinates.
    *   **Sync**: Coordinates (Latitude/Longitude) are pushed to the Firestore cloud database in real-time.
    *   **Caretaker View**: Caretakers see a live map with the patient's marker updating instantly as they move.
    *   **High Accuracy**: Configured to request high-accuracy GPS locks to ensure precise locating.

### 2.3. Medicine Reminder & Inventory
**Problem**: Forgetting medication is a primary cause of health deterioration.
**Solution**: A digital pillbox and scheduler.

*   **How it Works**:
    *   **Database**: Stores medicine names, dosages, and exact schedules (e.g., "09:00 AM") in Firestore.
    *   **Notifications**: The app checks the current time against the schedule and alerts the patient.
    *   **Adherence Tracking**: Caretakers can remotely modify the schedule and see if medicines were taken.

### 2.4. Caretaker Dashboard
**Problem**: Managing a patient involves multiple disjointed tasks (location, pills, appointments).
**Solution**: A "Mission Control" center for caretakers.

*   **Features**:
    *   **Map View**: Live satellite/street view of the patient.
    *   **Task Management**: Assign tasks to other family members or the patient.
    *   **Emergency Override**: Instant access to SOS contacts.

---

## 3. Technology Stack (The "Backend")

### 3.1. Frontend & Logic
*   **Framework**: **Next.js 14** (React Framework) for a fast, SEO-friendly, and responsive user interface.
*   **Language**: **TypeScript** for type-safe, robust code that minimizes bugs.
*   **Styling**: **Tailwind CSS** for a modern, clean, and accessible design system.

### 3.2. Backend & Cloud Infrastructure
*   **Database**: **Google Firebase Firestore** (NoSQL).
    *   *Why?* It offers "Real-time Listeners". When a patient moves or sends a chat, the Caretaker's screen updates *instantly* without refreshing.
*   **Authentication**: **Firebase Auth (Google Sign-In)**.
    *   *Why?* Secure, industry-standard login that protects sensitive patient data.
*   **Hosting**: **Vercel Edge Network**. Provides global, low-latency access to the application.

### 3.3. Artificial Intelligence
*   **Inference Engine**: **Groq Cloud**.
    *   *Why?* Groq's LPU (Language Processing Unit) allows Llama 3 to run at speeds >300 tokens/second, making the chat feel instantaneous (crucial for keeping a patient's attention).
*   **Image Generation**: **Pollinations.ai**.
    *   *Why?* Generates unlimited, copyright-free visualizations on the fly to explain medical concepts.

### 3.4. Mobile App
*   **Format**: **Android APK** (Wrapped PWA).
*   **Tech**: Built using Android Studio with a generic WebView wrapper, allowing the powerful web features to run natively on Android devices.

---

## 4. Security & Privacy
*   **Authorized Domains**: Access is strictly whitelisted to your specific deployment domains.
*   **Data Isolation**: Patient data is structured in isolated collections (`users/{userId}`), ensuring no cross-contamination of medical records.

---

****

---

## 5. App Modules & Structure
The application is divided into two distinct experience modules based on the user's role:

### 5.1. Patient Module
*   **Safety Dashboard**: The home screen featuring the panic button and connection status.
*   **Health Advisor**: The expandable AI chat interface for health queries and visual remedies.
*   **Medicine Cabinet**: A digital tracker for upcoming doses and medication inventory.
*   **Profile & Settings**: Management of personal details and linked caretakers.

### 5.2. Caretaker Module
*   **Command Center**: A full-screen map interface showing the patient's real-time movements.
*   **Task Manager**: A system to assign medicines or check-ins to the patient.
*   **Alert System**: A notification center for missed medicines, SOS calls, or "Zone Exits" (Geofence breaches).

---

## 6. Credits

### Lead Developer & Architect
**Ayush Raj**
*   **Backend Architecture**: Designed and implemented the secure, serverless backend infrastructure.
*   **Database Engineering**: Architected the Google Firebase Firestore database for real-time synchronization, data isolation, and query optimization.
*   **AI Integration**: Lead implementation of Llama 3 (via Groq) and Pollinations.ai generative systems.
*   **Full Stack Development**: Built the responsive Next.js frontend and the Android APK integration.

### Technology Attribution
**Powered By**:
*   **Llama 3 (via Groq)**: For intelligent, high-speed medical reasoning.
*   **Pollinations.ai**: For real-time generative visual aids.
*   **Google Firebase**: For serverless scale, secure auth, and real-time data sync.
*   **Next.js & Vercel**: For global performance and modern React architecture.

---

**Generated by GuardianAI | version 1.1**
