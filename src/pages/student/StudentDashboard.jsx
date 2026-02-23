import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../../firebase";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion } from "firebase/firestore";
import { useAuth } from "../../hooks/useAuth";

function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [teacher, setTeacher] = useState(null);
  const [practiceMode, setPracticeMode] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [activeTab, setActiveTab] = useState('schedule');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadStudentData();
  }, [user]);

  const loadStudentData = async () => {
    if (!user) return;

    try {
      // Get student info
      const studentDoc = await getDoc(doc(db, "users", user.uid));
      if (studentDoc.exists()) {
        const studentData = { id: studentDoc.id, ...studentDoc.data() };
        setStudent(studentData);
        setPracticeMode(studentData.practiceMode || 'teacher-guided');

        // Check if student has a teacher by looking for studios they're part of
        const studiosQuery = query(
          collection(db, "studios"),
          where("students", "array-contains", user.uid)
        );
        const studioDocs = await getDocs(studiosQuery);
        
        if (!studioDocs.empty) {
          const studioData = studioDocs.docs[0].data();
          
          // Get teacher info
          const teacherDoc = await getDoc(doc(db, "users", studioData.teacherId));
          if (teacherDoc.exists()) {
            setTeacher({ id: teacherDoc.id, ...teacherDoc.data() });
          }

          // Get current week's schedule
          const weekStart = getWeekStart();
          const schedulesQuery = query(
            collection(db, "practiceSchedules"),
            where("studentId", "==", user.uid),
            where("week", "==", weekStart)
          );
          const scheduleDocs = await getDocs(schedulesQuery);
          if (!scheduleDocs.empty) {
            setSchedule({ id: scheduleDocs.docs[0].id, ...scheduleDocs.docs[0].data() });
          }

          // Get assignments
          const assignmentsQuery = query(
            collection(db, "assignments"),
            where("studentId", "==", user.uid)
          );
          const assignmentDocs = await getDocs(assignmentsQuery);
          const assignmentData = assignmentDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAssignments(assignmentData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));

          // Get messages
          const messagesQuery = query(
            collection(db, "messages"),
            where("studentId", "==", user.uid)
          );
          const messageDocs = await getDocs(messagesQuery);
          const messageData = messageDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setMessages(messageData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        }
      }
    } catch (error) {
      console.error("Error loading student data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day;
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleJoinStudio = async (e) => {
    e.preventDefault();
    
    try {
      // Find studio with this join code
      const studiosQuery = query(
        collection(db, "studios"),
        where("joinCode", "==", joinCode.toUpperCase())
      );
      const studioDocs = await getDocs(studiosQuery);

      if (studioDocs.empty) {
        showToast("Invalid join code. Please check and try again.", 'error');
        return;
      }

      const studioDoc = studioDocs.docs[0];
      
      // Add student to studio
      await updateDoc(doc(db, "studios", studioDoc.id), {
        students: arrayUnion(user.uid)
      });

      // If student was self-paced, switch to teacher-guided
      if (practiceMode === 'self-paced') {
        await updateDoc(doc(db, "users", user.uid), {
          practiceMode: 'teacher-guided'
        });
        setPracticeMode('teacher-guided');
      }

      showToast("✓ Successfully joined studio!");
      setShowJoinModal(false);
      setJoinCode("");
      loadStudentData();
    } catch (error) {
      console.error("Error joining studio:", error);
      showToast("Error joining studio. Please try again.", 'error');
    }
  };

  const handleSwitchPracticeMode = async () => {
    const newMode = practiceMode === 'teacher-guided' ? 'self-paced' : 'teacher-guided';
    
    try {
      await updateDoc(doc(db, "users", user.uid), {
        practiceMode: newMode
      });
      
      setPracticeMode(newMode);
      showToast(`✓ Switched to ${newMode === 'self-paced' ? '🎯 Self-Paced' : '👨‍🏫 Teacher-Guided'} mode`);
    } catch (error) {
      console.error("Error switching practice mode:", error);
      showToast("Error switching mode", 'error');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
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
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-medium z-50 animate-fade-in ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-purple-600">🎵 Harmonia</h1>
              <div className="hidden md:flex space-x-4">
                <button className="text-gray-700 hover:text-purple-600 font-medium">
                  Home
                </button>
                <button 
                  onClick={() => navigate('/student/practice')}
                  className="text-gray-500 hover:text-purple-600"
                >
                  Practice
                </button>
                <button className="text-gray-500 hover:text-purple-600">
                  Resources
                </button>
                <button className="text-gray-500 hover:text-purple-600">
                  Messages
                </button>
                <button 
                  onClick={() => navigate('/student/tools')}
                  className="text-gray-500 hover:text-purple-600"
                >
                  Tools
                </button>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-700 hover:text-red-600"
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
            Hey {student?.name?.split(' ')[0]} 👋
          </h2>
          <p className="text-gray-600 mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* No Teacher - Show Join Prompt */}
        {!teacher && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <div className="flex items-start">
              <div className="shrink-0">
                <span className="text-3xl">🎓</span>
              </div>
              <div className="ml-4 flex-1">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  Join a Teacher's Studio
                </h3>
                <p className="text-blue-700 mb-4">
                  Connect with your teacher to receive personalized practice schedules and resources.
                </p>
                <button
                  onClick={() => setShowJoinModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Enter Join Code
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        {teacher && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            {/* Tab Navigation */}
            <div className="flex border-b mb-6">
              {['schedule', 'assignments', 'messages'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 font-medium transition ${
                    activeTab === tab
                      ? 'border-b-2 border-purple-600 text-purple-600'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {tab === 'schedule' && '📅 Schedule'}
                  {tab === 'assignments' && '📋 Assignments'}
                  {tab === 'messages' && '💬 Messages'}
                </button>
              ))}
            </div>

            {/* Practice Mode Badge with Switcher */}
            <div className="mb-6 flex items-center space-x-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                practiceMode === 'self-paced' 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-purple-100 text-purple-700'
              }`}>
                {practiceMode === 'self-paced' ? '🎯 Self-Paced' : '👨‍🏫 Teacher-Guided'}
              </span>
              <button
                onClick={handleSwitchPracticeMode}
                className="text-xs px-3 py-1 border border-gray-300 rounded-full hover:bg-gray-100 transition text-gray-700"
                title="Switch practice mode"
              >
                🔄 Switch
              </button>
              <div className="text-xs text-gray-500">
                {practiceMode === 'self-paced' 
                  ? "Create your own schedule" 
                  : teacher ? "Following teacher's schedule" : "No teacher yet"}
              </div>
            </div>

            {/* Schedule Tab */}
            {activeTab === 'schedule' && (
              <div>
                {schedule ? (
                  <div className="space-y-3">
                    {/* Warm Up */}
                    <div className="flex items-center p-4 bg-orange-50 rounded-lg">
                      <input
                        type="checkbox"
                        checked={schedule.sections?.warmUp?.completed || false}
                        readOnly
                        className="mr-3 h-5 w-5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <span className="text-xl mr-2">🔥</span>
                          <span className="font-semibold text-gray-800">Warm Up</span>
                          <span className="ml-auto text-sm text-gray-600">
                            {schedule.sections?.warmUp?.duration} min
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          {schedule.sections?.warmUp?.description}
                        </p>
                      </div>
                    </div>

                    {/* Technical */}
                    <div className="flex items-center p-4 bg-blue-50 rounded-lg">
                      <input
                        type="checkbox"
                        checked={schedule.sections?.technical?.completed || false}
                        readOnly
                        className="mr-3 h-5 w-5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <span className="text-xl mr-2">⚙️</span>
                          <span className="font-semibold text-gray-800">Technical Work</span>
                          <span className="ml-auto text-sm text-gray-600">
                            {schedule.sections?.technical?.duration} min
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          {schedule.sections?.technical?.description}
                        </p>
                      </div>
                    </div>

                    {/* Repertoire */}
                    <div className="flex items-center p-4 bg-purple-50 rounded-lg">
                      <input
                        type="checkbox"
                        checked={schedule.sections?.repertoire?.completed || false}
                        readOnly
                        className="mr-3 h-5 w-5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center mb-1">
                          <span className="text-xl mr-2">🎵</span>
                          <span className="font-semibold text-gray-800">Repertoire</span>
                          <span className="ml-auto text-sm text-gray-600">
                            {schedule.sections?.repertoire?.duration} min
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          {schedule.sections?.repertoire?.description}
                        </p>
                      </div>
                    </div>

                    {schedule.notes && (
                      <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
                        <p className="text-sm text-gray-700">
                          <strong>Teacher's notes:</strong> {schedule.notes}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => navigate('/student/practice')}
                      className="w-full mt-6 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold"
                    >
                      Start Practice →
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No practice schedule for this week yet.</p>
                    <p className="text-sm mt-2">Check back later or contact your teacher.</p>
                  </div>
                )}
              </div>
            )}

            {/* Assignments Tab */}
            {activeTab === 'assignments' && (
              <div>
                {assignments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-gray-400 text-4xl mb-2">📋</div>
                    <p>No assignments yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assignments.map((assignment) => {
                      const dueDate = new Date(assignment.dueDate);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const isOverdue = dueDate < today && !assignment.completed;
                      const isDueSoon = dueDate.toDateString() === today.toDateString() && !assignment.completed;

                      return (
                        <div
                          key={assignment.id}
                          className={`p-4 rounded-lg border-l-4 ${
                            assignment.completed
                              ? 'bg-gray-50 border-l-green-500 opacity-60'
                              : isOverdue
                              ? 'bg-red-50 border-l-red-500'
                              : isDueSoon
                              ? 'bg-yellow-50 border-l-yellow-500'
                              : 'bg-blue-50 border-l-blue-500'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-800">{assignment.title}</h4>
                              {assignment.description && (
                                <p className="text-gray-700 text-sm mt-1">{assignment.description}</p>
                              )}
                              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                                <span>📅 Due: {dueDate.toLocaleDateString()}</span>
                                {isOverdue && <span className="text-red-600 font-medium">Overdue</span>}
                                {isDueSoon && <span className="text-yellow-600 font-medium">Due Today</span>}
                                {assignment.completed && <span className="text-green-600 font-medium">✓ Completed</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Messages Tab */}
            {activeTab === 'messages' && (
              <div>
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-gray-400 text-4xl mb-2">💬</div>
                    <p>No messages yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-800">
                              {teacher?.name || 'Your Teacher'}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {new Date(message.createdAt).toLocaleDateString()} at {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          {!message.read && (
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                              New
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700">{message.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Practice Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">This Week's Progress</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-purple-600">0</div>
              <div className="text-sm text-gray-600">Practice Sessions</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600">0</div>
              <div className="text-sm text-gray-600">Minutes Practiced</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">0</div>
              <div className="text-sm text-gray-600">Day Streak</div>
            </div>
          </div>
        </div>
      </div>

      {/* Join Studio Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4">Join a Studio</h3>
            <p className="text-gray-600 mb-4">
              Enter the join code your teacher shared with you.
            </p>
            <form onSubmit={handleJoinStudio}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g., ABC123"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4 text-center text-2xl font-mono tracking-widest"
                maxLength="6"
                required
              />
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowJoinModal(false);
                    setJoinCode("");
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Join Studio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentDashboard;