import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useNavigate, Link } from "react-router-dom";

function SignUp() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
    instrument: "piano",
    practiceMode: "teacher-guided" // new field
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Store user data in Firestore
      await setDoc(doc(db, "users", userCredential.user.uid), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        instrument: formData.instrument,
        practiceMode: formData.role === "student" ? formData.practiceMode : null,
        createdAt: new Date()
      });

      // If teacher, create a studio
      if (formData.role === "teacher") {
        const studioCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await setDoc(doc(db, "studios", userCredential.user.uid), {
          teacherId: userCredential.user.uid,
          name: `${formData.name}'s Studio`,
          students: [],
          joinCode: studioCode,
          createdAt: new Date()
        });
      }

      // Redirect based on role
      navigate(formData.role === "teacher" ? "/teacher" : "/student");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">🎵 Harmonia</h1>
          <p className="text-gray-600 mt-2">Create your account</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
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
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="6"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              I am a...
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instrument
            </label>
            <select
              name="instrument"
              value={formData.instrument}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="piano">Piano</option>
              <option value="guitar">Guitar</option>
              <option value="violin">Violin</option>
              <option value="voice">Voice</option>
              <option value="drums">Drums</option>
              <option value="saxophone">Saxophone</option>
              <option value="flute">Flute</option>
              <option value="other">Other</option>
            </select>
          </div>

          {formData.role === "student" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                How would you like to practice?
              </label>
              <div className="space-y-2">
                <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-purple-50 transition">
                  <input
                    type="radio"
                    name="practiceMode"
                    value="teacher-guided"
                    checked={formData.practiceMode === "teacher-guided"}
                    onChange={handleChange}
                    className="w-4 h-4 text-purple-600"
                  />
                  <div className="ml-3">
                    <span className="font-medium text-gray-800">👨‍🏫 Teacher-Guided</span>
                    <p className="text-xs text-gray-600">Get a schedule from your teacher</p>
                  </div>
                </label>
                <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-purple-50 transition">
                  <input
                    type="radio"
                    name="practiceMode"
                    value="self-paced"
                    checked={formData.practiceMode === "self-paced"}
                    onChange={handleChange}
                    className="w-4 h-4 text-purple-600"
                  />
                  <div className="ml-3">
                    <span className="font-medium text-gray-800">🎯 Self-Paced</span>
                    <p className="text-xs text-gray-600">Create your own practice schedule</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-purple-600 hover:underline font-medium">
            Log In
          </Link>
        </p>
      </div>
    </div>
  );
}

export default SignUp;