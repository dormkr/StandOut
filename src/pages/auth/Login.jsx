import { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const { user, role } = useAuth();

  // If user is already logged in, they shouldn't be on login page
  // This will be handled by App.jsx routing

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("Login successful, waiting for AuthContext to update...");
      // Don't navigate here - let the AuthContext handle it via the App routing
      // The onAuthStateChanged listener will trigger and set the role
    } catch (err) {
      console.error("Login error:", err);
      setError("Invalid email or password");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">🎵 Harmonia</h1>
          <p className="text-gray-600 mt-2">Welcome back</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed active:scale-95"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Don't have an account?{" "}
          <Link to="/signup" className="text-purple-600 hover:underline font-medium">
            Sign Up
          </Link>
        </p>
        
        {/* Debug button - click 5 times to show debug info */}
        <div className="mt-8 text-center">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Status
          </button>
        </div>
        
        {showDebug && (
          <div className="mt-4 p-3 bg-gray-100 rounded text-xs text-gray-700 max-h-40 overflow-auto">
            <div className="font-semibold mb-2">Debug Info:</div>
            <div>User: {user ? user.uid : 'not-logged-in'}</div>
            <div>Role: {role || 'loading'}</div>
            <div>Loading: {loading.toString()}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;