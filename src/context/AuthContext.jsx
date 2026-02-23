import { createContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Set a timeout to ensure loading ends even if auth check hangs
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Auth check timeout - setting loading to false');
        setLoading(false);
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          setUser(firebaseUser);
          // Get user role from Firestore
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              setRole(userDoc.data().role);
            } else {
              console.warn('User document not found in Firestore');
              setRole(null);
            }
          } catch (firestoreErr) {
            console.warn('Firestore error (collection may not exist yet):', firestoreErr.message);
            setRole(null);
          }
        } else {
          setUser(null);
          setRole(null);
        }
      } catch (err) {
        setError(err.message);
        console.error('Auth error:', err);
      } finally {
        setLoading(false);
        clearTimeout(timeout);
      }
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setRole(null);
    } catch (err) {
      setError(err.message);
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, error, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
