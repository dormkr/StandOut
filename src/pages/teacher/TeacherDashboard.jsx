import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "../../hooks/useAuth";

function TeacherDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [studio, setStudio] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [teacher, setTeacher] = useState(null);

  useEffect(() => {
    loadStudioAndStudents();
  }, [user]);

  const loadStudioAndStudents = async () => {
    if (!user) return;

    try {
      // Get teacher info
      const teacherDoc = await getDoc(doc(db, "users", user.uid));
      if (teacherDoc.exists()) {
        setTeacher(teacherDoc.data());
      }

      // Get studio info
      const studioDoc = await getDoc(doc(db, "studios", user.uid));
      if (studioDoc.exists()) {
        const studioData = { id: studioDoc.id, ...studioDoc.data() };
        setStudio(studioData);

        // Get students
        if (studioData.students && studioData.students.length > 0) {
          const studentPromises = studioData.students.map(studentId =>
            getDoc(doc(db, "users", studentId))
          );
          const studentDocs = await Promise.all(studentPromises);
          const studentData = studentDocs
            .filter(doc => doc.exists())
            .map(doc => ({ id: doc.id, ...doc.data() }));
          setStudents(studentData);
        }
      }

      // Get unread messages count
      const messagesQuery = query(
        collection(db, "messages"),
        where("studentId", "==", user.uid),
        where("read", "==", false)
      );
      const messageDocs = await getDocs(messagesQuery);
      setUnreadMessages(messageDocs.size);
    } catch (error) {
      console.error("Error loading studio:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const copyJoinCode = () => {
    if (studio?.joinCode) {
      navigator.clipboard.writeText(studio.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-purple-600">🎵 Harmonia</h1>
              <div className="hidden md:block">
                <span className="text-sm text-gray-600">
                  {teacher?.name || 'Teacher'}
                </span>
              </div>
            </div>
            <button
              onClick={loadStudioAndStudents}
              className="px-3 py-2 text-sm text-gray-600 hover:text-purple-600 mr-4 transition"
              title="Refresh"
            >
              🔄 Refresh
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-700 hover:text-red-600 font-medium"
            >
              Log Out
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800">
            {getGreeting()}, {teacher?.name || 'Teacher'}! 👋
          </h2>
          <p className="text-gray-600 mt-1">Here's what's happening with your students today.</p>
        </div>

        {/* Studio Info Card */}
        {studio && (
          <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg p-6 mb-8 text-white">
            <h3 className="text-xl font-semibold mb-2">{studio.name}</h3>
            <div className="flex items-center space-x-6">
              <div>
                <p className="text-purple-100 text-sm">Studio Join Code</p>
                <div className="flex items-center space-x-2">
                  <p className="text-2xl font-mono font-bold">{studio.joinCode}</p>
                  <button
                    onClick={copyJoinCode}
                    className="px-3 py-1 bg-white bg-opacity-20 hover:bg-opacity-30 rounded text-sm font-medium transition"
                  >
                    {copied ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div>
                <p className="text-purple-100 text-sm">Total Students</p>
                <p className="text-2xl font-bold">{students.length}</p>
              </div>
            </div>
            <p className="text-purple-100 text-sm mt-4">
              Share this code with students so they can join your studio
            </p>
          </div>
        )}

        {/* Students Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800">My Students ({students.length})</h3>
            <button 
              onClick={() => navigate('/teacher/add-student')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition"
            >
              + Add Student
            </button>
          </div>

          {students.length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center">
              <div className="text-gray-400 text-5xl mb-4">🎵</div>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">No students yet</h4>
              <p className="text-gray-600 mb-4">
                Share your studio join code with students to get started
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.map((student) => (
                <div
                  key={student.id}
                  onClick={() => navigate(`/teacher/student/${student.id}`)}
                  className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition cursor-pointer border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{student.name}</h4>
                      <p className="text-sm text-gray-500 capitalize">{student.instrument}</p>
                    </div>
                    <span className="text-2xl ml-2">
                      {student.instrument === 'piano' ? '🎹' : 
                       student.instrument === 'guitar' ? '🎸' :
                       student.instrument === 'violin' ? '🎻' :
                       student.instrument === 'voice' ? '🎤' :
                       student.instrument === 'drums' ? '🥁' : '🎵'}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-gray-600 pt-3 border-t border-gray-100">
                    <span>📅</span>
                    <span>{student.createdAt ? new Date(student.createdAt.toDate?.() || student.createdAt).toLocaleDateString() : 'Recently added'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-6 border border-gray-200 hover:shadow-md transition cursor-pointer opacity-50">
            <div className="text-purple-600 text-2xl mb-2">📚</div>
            <h4 className="font-semibold text-gray-800 mb-1">Resource Library</h4>
            <p className="text-sm text-gray-600">Coming soon</p>
          </div>
          <div className="bg-white rounded-lg p-6 border border-gray-200 hover:shadow-md transition cursor-pointer">
            <div className="text-blue-600 text-2xl mb-2">💬</div>
            <h4 className="font-semibold text-gray-800 mb-1">Messages Sent</h4>
            <p className="text-sm text-gray-600">{unreadMessages} unread responses</p>
          </div>
          <div className="bg-white rounded-lg p-6 border border-gray-200 hover:shadow-md transition cursor-pointer opacity-50">
            <div className="text-green-600 text-2xl mb-2">📊</div>
            <h4 className="font-semibold text-gray-800 mb-1">Analytics</h4>
            <p className="text-sm text-gray-600">Coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TeacherDashboard;