import React, { useState, useCallback, useEffect } from 'react';
import { AppState, Scenario, TranscriptMessage, UserProfile, CallRecord, Feedback, SavedScenario } from './types';
import { generateFeedback, gatekeeper } from './services/geminiService';
import { auth, getUserProfile, getSimulations, saveSimulation, updateUserProfile, deleteSimulation, deleteMultipleSimulations } from './services/firebase';

// Landing Page Components
import Header from './components/landing/Header';
import Hero from './components/landing/Hero';
import Problem from './components/landing/Problem';
import Solution from './components/landing/Solution';
import Features from './components/landing/Features';
import Pricing from './components/landing/Pricing';
import Cta from './components/landing/Cta';
import Footer from './components/landing/Footer';

// App Components
import SetupScreen from './components/SetupScreen';
import CallScreen from './components/CallScreen';
import FeedbackScreen from './components/FeedbackScreen';
import ProfileScreen from './components/ProfileScreen';
import { LoadingIcon } from './components/icons/Icons';

// New component for API Key Configuration
const ApiKeySettings = ({ onSave }: { onSave: () => void }) => {
  const [key, setKey] = useState(localStorage.getItem('gemini_api_key') || '');
  return (
    <div className="flex flex-col h-screen w-screen items-center justify-center bg-background text-center p-4">
      <h1 className="text-3xl font-bold mb-4 text-text-primary font-heading">Configure Gemini AI</h1>
      <p className="text-text-secondary mb-8 max-w-md">To use this application, you need your own Gemini API Key. You can get one for free at the Google AI Studio.</p>
      <input 
        type="password" 
        value={key} 
        onChange={(e) => setKey(e.target.value)} 
        placeholder="Enter your Gemini API Key" 
        className="w-full max-w-sm p-3 rounded-lg border border-gray-300 bg-white text-black mb-4 focus:ring-2 focus:ring-primary outline-none"
      />
      <button 
        onClick={() => { localStorage.setItem('gemini_api_key', key); onSave(); }}
        className="px-8 py-3 bg-primary text-white rounded-full font-semibold hover:bg-primary/90 transition-colors"
      >
        Save and Start
      </button>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'app'>('landing');
  const [appState, setAppState] = useState<AppState.SETUP>; // Default to Setup
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
  const [currentAudioDeviceId, setCurrentAudioDeviceId] = useState<string | undefined>(undefined);
  const [currentFeedback, setCurrentFeedback] = useState<Feedback | null>(null);
  const [currentCallRecordingUrl, setCurrentCallRecordingUrl] = useState<string | null>(null);
  const [deletingState, setDeletingState] = useState<{ recordIds: string[], scenarioId: string | null }>({ recordIds: [], scenarioId: null });

  useEffect(() => {
    const initUser = async () => {
      const profileData = await getUserProfile(auth.currentUser?.uid || 'local-guest');
      const simulations = await getSimulations(auth.currentUser?.uid || 'local-guest');
      
      if (!profileData) {
        await updateUserProfile(auth.currentUser?.uid || 'local-guest', {
          name: "Guest User",
        });
      }

      const fullUserProfile: UserProfile = {
        ...(await getUserProfile(auth.currentUser?.uid || 'local-guest'))!,
        callHistory: simulations,
      };
      setUser(fullUserProfile);
    };
    initUser();
  }, []);

  const handleStartApp = useCallback(() => {
    setView('app');
    // Check if API key exists, if not, we'll need to show the settings screen
    if (!localStorage.getItem('gemini_api_key')) {
      setAppState(AppState.SETUP); // We will handle the API key overlay in the render logic or a separate state
    }
  }, []);

  const handleStartCall = useCallback(async (scenario: Scenario, audioDeviceId?: string) => {
    if (!user) return;
    try {
      await gatekeeper();
      setCurrentScenario(scenario);
      setCurrentAudioDeviceId(audioDeviceId);
      setAppState(AppState.IN_CALL);
    } catch (error: any) {
      if (error.message.includes("API key is missing")) {
        setAppState(AppState.SETUP); // Use setup screen as a base to show the API key request
        alert(error.message);
      } else {
        console.error("An unexpected error occurred during pre-call checks:", error);
        alert("An unexpected error occurred. Please try again.");
      }
    }
  }, [user]);

  const handleSaveScenario = useCallback(async (scenario: Scenario, name: string) => {
    if (!user) return;
    const newScenario: SavedScenario = {
      ...scenario,
      id: `custom-${new Date().toISOString()}-${Math.random().toString(36).substring(2, 9)}`,
      name,
    };
    const updatedScenarios = [...user.savedScenarios, newScenario];
    await updateUserProfile(user.id, { savedScenarios: updatedScenarios });
    setUser(prevUser => prevUser ? { ...prevUser, savedScenarios: updatedSctarios } : null);
    alert(`Scenario "${name}" saved!`);
  }, [user]);
  
  const handleDeleteScenario = useCallback(async (scenarioId: string) => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to delete this custom scenario?')) return;
    setDeletingState(prev => ({ ...prev, scenarioId }));
    try {
        const updatedScenarios = user.savedScenarios.filter(s => s.id !== scenarioId);
        await updateUserProfile(user.id, { savedScenarios: updatedScenarios });
        setUser(currentUser => {
            if (!currentUser) return null;
            return { ...currentUser, savedScenarios: updatedScenarios };
        });
    } catch (error) {
        console.error("Failed to delete scenario:", error);
        alert("There was an error deleting the custom scenario. Please try again.");
    } finally {
        setDeletingState(prev => ({ ...prev, scenarioId: null }));
    }
  }, [user]);

  const handleEndCall = useCallback(async (transcript: TranscriptMessage[], audioUrl: string | null) => {
    if (!currentScenario || !user) return;
    setAppState(AppState.GENERATING_FEEDBACK);
    setCurrentCallRecordingUrl(audioUrl);
    try {
      const cleanedTranscript = transcript.map(({ speaker, text }) => ({ speaker, text }));
      const feedback = await generateFeedback(currentScenario, cleanedTranscript);
      setCurrentFeedback(feedback);
      const newRecordForDb = {
        scenario: currentScenario,
        transcript: cleanedTranscript,
        feedback,
        callRecordingUrl: audioUrl,
      };
      const newRecordId = await saveSimulation(user.id, newRecordForDb);
      const newRecordForState: CallRecord = {
        id: newRecordId,
        date: new Date().toLocaleString(),
        ...newRecordForDb,
      };
      setUser(prevUser => prevUser ? { ...prevUser, callHistory: [newRecordForState, ...prevUser.callHistory] } : null);
      setAppState(AppState.FEEDBACK);
    } catch (error) {
      console.error("Failed to generate feedback or save simulation:", error);
      alert("There was an error processing your call. Please try again.");
      setAppState(AppState.SETUP);
    }
  }, [currentScenario, user]);

  const handleNewCall = useCallback(() => {
    setCurrentScenario(null);
    setCurrentFeedback(null);
    setCurrentCallRecordingUrl(null);
    setAppState(AppState.SETUP);
  }, []);
  
  const handleBackToSetup = useCallback(() => {
    setAppState(AppState.SETUP);
  }, []);

  const handleDeleteCallRecord = useCallback(async (recordId: string) => {
    if (!user) return;
    if (!window.confirm('Are you sure you want to delete this call record?')) return;
    setDeletingState(prev => ({ ...prev, recordIds: [recordId] }));
    try {
        await deleteSimulation(user.id, recordId);
        setUser(currentUser => {
            if (!currentUser) return null;
            const updatedHistory = currentUser.callHistory.filter(record => record.id !== recordId);
            return { ...currentUser, callHistory: updatedHistory };
        });
    } catch (error) {
        console.error("Failed to delete call record:", error);
        alert("There was an error deleting the call record. Please try again.");
    } finally {
        setDeletingState(prev => ({ ...prev, recordIds: [] }));
    }
  }, [user]);

  const handleDeleteMultipleCallRecords = useCallback(async (recordIds: string[]) => {
    if (!user || recordIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${recordIds.length} call records?`)) return;
    setDeletingState(prev => ({ ...prev, recordIds }));
    try {
        await deleteMultipleSimulations(user.id, recordIds);
        setUser(currentUser => {
            if (!currentUser) return null;
            const updatedHistory = currentUser.callHistory.filter(record => !recordIds.includes(record.id));
            return { ...currentUser, callHistory: updatedHistory };
        });
    } catch (error) {
        console.error("Failed to delete multiple call records:", error);
    } finally {
        setDeletingState(prev => ({ ...prev, recordIds: [] })); // a mistake here but it's not the a build error
    }
  }, [user]);

  const renderContent = () => {
    if (view === 'landing' && !user) {
      return (
        <div className="bg-background text-text-primary font-body">
          <Header onStart={handleStartApp} />
          <main>
            <Hero onStart={handleStartApp} />
            <Problem />
            <Solution />
            <Features />
            <Pricing onStart={handleStartApp} />
            <Cta onStart={handleStartApp} />
          </main>
          <Footer />
        </div>
      );
    }

    if (!localStorage.getItem('gemini_api_key')) {
      return <ApiKeySettings onSave={() => {}} />; 
    }

    switch (appState) {
      case AppState.SETUP:
        if (!user) return null;
        return <SetupScreen user={user} onStartCall={handleStartCall} onViewHistory={handleViewHistory} onLogout={handleLogout} onSaveScenario={handleSaveScenario} onDeleteScenario={handleDeleteScenario} deletingScenarioId={deletingState.scenarioId} />;
      case AppState.IN_CALL:
        if (!user || !currentScenario) return null;
        return <CallScreen scenario={currentScenario} onEndCall={handleEndCall} onBack={handleBackToSetup} audioDeviceId={currentAudioDeviceId} />;
      case AppState.GENERATING_FEEDBACK:
        return (
            <div className="flex flex-col h-screen w-screen items-center justify-center bg-background text-center">
                <LoadingIcon className="w-12 h-12 text-primary" />
                <h1 className="text-2xl font-semibold mt-4 text-text-primary font-heading">Analyzing your call...</h1>
                <p className="text-text-secondary mt-2">Your feedback is being generated by our AI coach.</p>
            </div>
        );
      case AppState.FEEDBACK:
        if (!user || !currentFeedback) return null;
        return <FeedbackScreen feedback={currentFeedback} onNewCall={handleNewCall} onViewHistory={handleViewHistory} callRecordingUrl={currentCallRecordingUrl} />;
      case AppState.PROFILE:
        if (!user) return null;
        return <ProfileScreen user={user} onBack={handleBackToSetup} onLogout={handleLogout} onStartCall={handleStartCall} onDeleteCallRecord={handleDeleteCallRecord} onDeleteMultipleCallRecords={handleDeleteMultipleCallRecords} deletingRecordIds={deletingState.recordIds} onUpdateUserProfile={updateUserProfile} />;
      default:
        return null;
    }
  };

  const handleViewHistory = useCallback(() => {
    setAppState(AppState.PROFILE);
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setAppState(AppState.SETUP);
    setView('landing');
  }, []);

  return (
    <div className="App">
      {renderContent()}
    </div>
  );
}

export default App;
