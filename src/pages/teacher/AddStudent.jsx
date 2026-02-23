import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc, arrayUnion, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../hooks/useAuth";

function AddStudent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [method, setMethod] = useState("invite"); // "invite" or "existing"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // For invite method
  const [inviteData, setInviteData] = useState({
    name: "",
    email: "",
    instrument: "piano"
  });

  // For existing student method
  const [studioCode, setStudioCode] = useState("");

  const handleInviteChange = (e) => {
    setInviteData({
      ...inviteData,
      [e.target.name]: e.target.value
    });
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Create a new student user document
      const studentId = `student_${Date.now()}`;
      await setDoc(doc(db, "users", studentId), {
        name: inviteData.name,
        email: inviteData.email,
        instrument: inviteData.instrument,
        role: "student",
        createdAt: new Date(),
        studioId: user.uid
      });

      // Add student to teacher's studio
      const studioRef = doc(db, "studios", user.uid);
      await updateDoc(studioRef, {
        students: arrayUnion(studentId)
      });

      setSuccess(`Student ${inviteData.name} added successfully!`);
      setTimeout(() => {
        navigate("/teacher");
      }, 2000);
    } catch (err) {
      console.error("Error adding student:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleExistingSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Find student by join code in their user document
      // For now, show message that this feature requires student-initiated join
      setError("Students should enter the studio code in their profile to join your studio.");
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              onClick={() => navigate("/teacher")}
              className="text-gray-600 hover:text-gray-900 flex items-center space-x-2"
            >
              <span>← Back to Dashboard</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Add a Student</h1>
          <p className="text-gray-600 mb-8">Choose how to add a new student to your studio</p>

          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 border border-red-200">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 border border-green-200">
              ✓ {success}
            </div>
          )}

          {/* Method Selection */}
          <div className="flex space-x-4 mb-8">
            <button
              onClick={() => setMethod("invite")}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                method === "invite"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Invite New Student
            </button>
            <button
              onClick={() => setMethod("existing")}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${
                method === "existing"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Existing Student
            </button>
          </div>

          {/* Invite Form */}
          {method === "invite" && (
            <form onSubmit={handleInviteSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Student Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={inviteData.name}
                  onChange={handleInviteChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={inviteData.email}
                  onChange={handleInviteChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="student@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instrument
                </label>
                <select
                  name="instrument"
                  value={inviteData.instrument}
                  onChange={handleInviteChange}
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

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                >
                  {loading ? "Adding Student..." : "Add Student"}
                </button>
              </div>
            </form>
          )}

          {/* Existing Student Form */}
          {method === "existing" && (
            <form onSubmit={handleExistingSubmit} className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-blue-800 text-sm">
                  <strong>How it works:</strong> Students can join your studio by entering your studio join code in their profile settings. They'll automatically appear in your student list once they join.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Studio Join Code
                </label>
                <input
                  type="text"
                  value={studioCode}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
                  placeholder="Students will enter this code"
                />
                <p className="text-xs text-gray-600 mt-2">
                  Share this code from your dashboard with students
                </p>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => navigate("/teacher")}
                  className="w-full bg-gray-300 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-400 transition"
                >
                  Back to Dashboard
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddStudent;
