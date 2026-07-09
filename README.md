# 🚀 Apex AI - Open Source Sales Coach

A real-time, voice-enabled AI role-playing application for sales professionals to practice conversations and handle objections.

## ✨ Features
- **AI Role-Play:** Practice realistic sales calls with an AI client.
- **Real-time Voice:** Natural voice interactions powered by Gemini.
- **Automated Coaching:** Get detailed, critical feedback and scoring after every call.
- **Custom Scenarios:** Create and save your own sales scenarios to practice specific industries or personas.
- **Privacy First:** All data (call history, scenarios) is stored locally in your browser.

## 🛠️ Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Gemini API Key:** Get a free key from [Google AI Studio](https://aistudio.google.com/).

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/apex-ai.git
   cd apex-ai
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open the app in your browser and enter your **Gemini API Key** when prompted.

## 🔒 Security & Privacy
This application is designed to be self-hosted and private. 
- **No Accounts:** There is no central authentication server.
- **Local Storage:** Your call history and preferences are stored in your browser's `localStorage`.
- **API Keys:** Your Gemini API key is stored locally in your browser and is never sent to any server other than Google's official Gemini API.

## 📄 License
This project is licensed under the MIT License.
