import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { User } from 'firebase/auth';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

type UserRole = 'admin' | 'client';

type UserProfile = {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: 'active' | 'disabled';
  companyName?: string;
  phone?: string;
  mustChangePassword?: boolean;
};

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<UserRole>;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function getUserProfile(uid: string): Promise<UserProfile> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    throw new Error('USER_PROFILE_NOT_FOUND');
  }

  const data = userSnap.data() as UserProfile;

  if (data.status && data.status !== 'active') {
    throw new Error('USER_NOT_ACTIVE');
  }

  if (data.role !== 'admin' && data.role !== 'client') {
    throw new Error('INVALID_ROLE');
  }

  return data;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setLoading(true);

        if (!firebaseUser) {
          setUser(null);
          setProfile(null);
          return;
        }

        const userProfile = await getUserProfile(firebaseUser.uid);

        setUser(firebaseUser);
        setProfile(userProfile);
      } catch (error) {
        console.error(error);

        setUser(null);
        setProfile(null);

        await signOut(auth);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<UserRole> => {
    const credential = await signInWithEmailAndPassword(auth, email, password);

    const userProfile = await getUserProfile(credential.user.uid);

    setUser(credential.user);
    setProfile(userProfile);

    return userProfile.role;
  };

  const logout = async () => {
    await signOut(auth);

    setUser(null);
    setProfile(null);

    localStorage.removeItem('isAuthenticated');
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
  setProfile((currentProfile) => {
    if (!currentProfile) return currentProfile;

    return {
      ...currentProfile,
      ...updates,
    };
  });
};

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role || null,
        loading,
        isAuthenticated: !!user && !!profile,
        login,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};