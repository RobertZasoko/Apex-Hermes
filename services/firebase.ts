import { UserProfile, CallRecord } from "../types";

/**
 * LocalStorage-based implementation of User Profiles and Call History.
 * This replaces the Firebase-backed infrastructure for a self-hosted open-source version.
 */

const STORAGE_KEYS = {
  USER_PROFILE: 'apex_user_profile',
  SIMULATIONS: 'apex_simulations',
};

// Mock User ID for the local guest session
const LOCAL_USER_ID = 'local-guest-user';

export const getUserProfile = async (userId: string = LOCAL_USER_ID): Promise<Omit<UserProfile, 'callHistory'> | null> => {
    const profile = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (profile) {
        return JSON.parse(profile);
    }
    return null;
};

export const saveSimulation = async (userId: string, simulationData: { scenario: any; transcript: any; feedback: any; callRecordingUrl: string | null; }): Promise<string> => {
    const simulations = await getSimulations(userId);
    const newId = `sim-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    const newRecord: CallRecord = {
        id: newId,
        date: new Date().toLocaleString(),
        scenario: simulationData.scenario,
        transcript: simulationData.transcript,
        feedback: simulationData.feedback,
        callRecordingUrl: simulationData.callRecordingUrl,
    };

    localStorage.setItem(STORAGE_KEYS.SIMULATIONS, JSON.stringify([newRecord, ...simulations]));
    return newId;
};

export const deleteSimulation = async (userId: string, simulationId: string): Promise<void> => {
    const simulations = await getSimulations(userId);
    const filtered = simulations.filter(s => s.id !== simulationId);
    localStorage.setItem(STORAGE_KEYS.SIMULATIONS, JSON.stringify(filtered));
};

export const deleteMultipleSimulations = async (userId: string, simulationIds: string[]): Promise<void> => {
    const simulations = await getSimulations(userId);
    const filtered = simulations.filter(s => !simulationIds.includes(s.id));
    localStorage.setItem(STORAGE_KEYS.SIMULATIONS, JSON.stringify(filtered));
};

export const getSimulations = async (userId: string = LOCAL_USER_ID): Promise<CallRecord[]> => {
    const data = localStorage.getItem(STORAGE_KEYS.SIMULATIONS);
    return data ? JSON.parse(data) : [];
};

export const updateUserProfile = async (userId: string, data: Partial<Omit<UserProfile, 'id' | 'email' | 'callHistory'>>): Promise<void> => {
    const existing = await getUserProfile(userId);
    const updatedProfile = {
        id: userId,
        name: data.name || existing?.name || "Guest User",
        email: data.email || existing?.email || null,
        savedScenarios: data.savedScenarios || existing?.savedScenarios || [],
        subscriptionStatus: 'pro', // Everyone is Pro in open source version
        freeCredits: 999999, // Unlimited
        createdAt: existing?.createdAt || new Date(),
        ...data,
    };
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(updatedProfile));
};

export const decrementUserCredits = async (userId: string): Promise<void> => {
    // No-op in open source version
    return Promise.resolve();
};

// Auth stubs to prevent breaking existing components immediately
export const auth = {
    currentUser: {
        uid: LOCAL_USER_ID,
        displayName: "Guest User",
        email: "guest@example.com",
        emailVerified: true,
    },
    onAuthStateChanged: (cb: any) => {
        cb(auth.currentUser);
        return () => {};
    }
};

export const googleProvider = {};
export const signInWithPopup = async () => ({ uid: LOCAL_USER_ID } as any);
export const createUserWithEmailAndPassword = async () => ({ uid: LOCAL_USER_ID } as any);
export const signInWithEmailAndPassword = async () => ({ uid: LOCAL_USER_ID } as any);
export const signOut = async () => {};
export const onAuthStateChanged = (cb: any) => { cb(auth.currentUser); return () => {}; };
export const sendEmailVerification = async () => {};
