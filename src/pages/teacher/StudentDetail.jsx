import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../hooks/useAuth";

function StudentDetail() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [activeTab, setActiveTab] = useState('schedule');
  const [schedule, setSchedule] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState('');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const pushDebug = (msg) => {
    setDebugLogs((d) => [...d.slice(-30), `${new Date().toLocaleTimeString()}: ${msg}`]);
    try { console.log(msg); } catch (e) {}
  };

  // Modal states
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Assignment form state
  const [assignmentForm, setAssignmentForm] = useState({
    title: '',
    description: '',
    dueDate: '',
  });
  const [sendingAssignment, setSendingAssignment] = useState(false);

  // Form state for creating schedule
  const [scheduleForm, setScheduleForm] = useState({
    warmUp: { description: '', duration: 10 },
    technical: { description: '', duration: 15 },
    repertoire: { description: '', duration: 25 },
    notes: ''
  });

  useEffect(() => {
    loadStudentData();
  }, [studentId]);

  const loadStudentData = async () => {
    try {
      // Get student info
      const studentDoc = await getDoc(doc(db, "users", studentId));
      if (studentDoc.exists()) {
        setStudent({ id: studentDoc.id, ...studentDoc.data() });
      }

      // Get current week's schedule
      const weekStart = getWeekStart();
      const schedulesQuery = query(
        collection(db, "practiceSchedules"),
        where("studentId", "==", studentId),
        where("week", "==", weekStart)
      );
      const scheduleDocs = await getDocs(schedulesQuery);
      if (!scheduleDocs.empty) {
        setSchedule({ id: scheduleDocs.docs[0].id, ...scheduleDocs.docs[0].data() });
        // Populate form with existing data
        const data = scheduleDocs.docs[0].data();
        setScheduleForm({
          warmUp: data.sections?.warmUp || { description: '', duration: 10 },
          technical: data.sections?.technical || { description: '', duration: 15 },
          repertoire: data.sections?.repertoire || { description: '', duration: 25 },
          notes: data.notes || ''
        });
      }

      // Get assignments for this student
      const assignmentsQuery = query(
        collection(db, "assignments"),
        where("studentId", "==", studentId)
      );
      const assignmentDocs = await getDocs(assignmentsQuery);
      const assignmentData = assignmentDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAssignments(assignmentData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (error) {
      console.error("Error loading student:", error);
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

  const handleScheduleChange = (section, field, value) => {
    setScheduleForm({
      ...scheduleForm,
      [section]: {
        ...scheduleForm[section],
        [field]: value
      }
    });
  };

  const handleSaveSchedule = async () => {
    pushDebug("Teacher save schedule clicked!");
    setIsSavingSchedule(true);
    try {
      setSaveMessage('');
      pushDebug("Schedule form: " + JSON.stringify(scheduleForm));
      const weekStart = getWeekStart();
      pushDebug("Week start: " + weekStart);
      // Validate form has content
      const hasContent = scheduleForm.warmUp.description || scheduleForm.technical.description || scheduleForm.repertoire.description;
      if (!hasContent) {
        pushDebug("Form validation failed: no content");
        setSaveMessage('\u2717 Please fill in at least one section');
        setTimeout(() => setSaveMessage(''), 3000);
        setIsSavingSchedule(false);
        return;
      }
      const scheduleData = {
        teacherId: user.uid,
        studentId: studentId,
        week: weekStart,
        sections: {
          warmUp: { ...scheduleForm.warmUp, completed: false },
          technical: { ...scheduleForm.technical, completed: false },
          repertoire: { ...scheduleForm.repertoire, completed: false }
        },
        notes: scheduleForm.notes,
        createdAt: new Date().toISOString()
      };
      pushDebug("Schedule data to save: " + JSON.stringify(scheduleData).substring(0, 100) + "...");
      let scheduleId = schedule?.id;
      if (schedule) {
        // Update existing
        pushDebug("Updating existing schedule: " + schedule.id);
        await updateDoc(doc(db, "practiceSchedules", schedule.id), scheduleData);
      } else {
        // Create new
        pushDebug("Creating new schedule");
        const docRef = await addDoc(collection(db, "practiceSchedules"), scheduleData);
        scheduleId = docRef.id;
        pushDebug("New schedule created with ID: " + scheduleId);
        // Update schedule state immediately so the UI refreshes
        setSchedule({ id: scheduleId, ...scheduleData });
      }
      // Update student's practiceMode to teacher-guided
      try {
        await updateDoc(doc(db, "users", studentId), { practiceMode: "teacher-guided" });
        pushDebug("Student practiceMode set to teacher-guided");
      } catch (err) {
        pushDebug("Failed to update student practiceMode: " + (err?.message || String(err)));
      }
      pushDebug("Showing success message");
      setSaveMessage('\u2713 Schedule saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      setIsSavingSchedule(false);
    } catch (error) {
      const errorMsg = error?.message || String(error);
      pushDebug("Error saving schedule: " + errorMsg);
      console.error("Error saving schedule:", error);
      setSaveMessage('\u2717 Error saving schedule: ' + errorMsg);
      setTimeout(() => setSaveMessage(''), 3000);
      setIsSavingSchedule(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      setSaveMessage('Please enter a message');
      setTimeout(() => setSaveMessage(''), 2000);
      return;
    }

    setSendingMessage(true);
    try {
      await addDoc(collection(db, "messages"), {
        teacherId: user.uid,
        studentId: studentId,
        text: messageText,
        createdAt: new Date(),
        read: false
      });

      setMessageText('');
      setShowMessageModal(false);
      setSaveMessage('✓ Message sent successfully!');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch (error) {
      console.error("Error sending message:", error);
      setSaveMessage('✗ Error sending message');
      setTimeout(() => setSaveMessage(''), 2000);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSendAssignment = async () => {
    if (!assignmentForm.title.trim() || !assignmentForm.dueDate) {
      setSaveMessage('Please fill in all required fields');
      setTimeout(() => setSaveMessage(''), 2000);
      return;
    }

    setSendingAssignment(true);
    try {
      await addDoc(collection(db, "assignments"), {
        teacherId: user.uid,
        studentId: studentId,
        title: assignmentForm.title,
        description: assignmentForm.description,
        dueDate: assignmentForm.dueDate,
        createdAt: new Date(),
        completed: false
      });

      setAssignmentForm({ title: '', description: '', dueDate: '' });
      setShowAssignmentModal(false);
      setSaveMessage('✓ Assignment created successfully!');
      setTimeout(() => setSaveMessage(''), 2000);
      loadStudentData();
    } catch (error) {
      console.error("Error creating assignment:", error);
      setSaveMessage('✗ Error creating assignment');
      setTimeout(() => setSaveMessage(''), 2000);
    } finally {
      setSendingAssignment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Student not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate('/teacher')}
            className="text-gray-600 hover:text-gray-800 mb-2 flex items-center"
          >
            ← Back to Dashboard
          </button>
          <div className="flex items-center space-x-4">
            <span className="text-4xl">
              {student.instrument === 'piano' ? '🎹' : 
               student.instrument === 'guitar' ? '🎸' :
               student.instrument === 'violin' ? '🎻' :
               student.instrument === 'voice' ? '🎤' :
               student.instrument === 'drums' ? '🥁' : '🎵'}
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{student.name}</h1>
              <p className="text-gray-600 capitalize">{student.instrument}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {['schedule', 'assignments'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'schedule' ? '📅 Schedule' : '📋 Assignments'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Save/Error Message Toast */}
        {saveMessage && (
          <div className={`mb-4 p-4 rounded-lg text-white text-sm font-medium ${
            saveMessage.startsWith('✓') ? 'bg-green-500' : 'bg-red-500'
          }`}>
            {saveMessage}
          </div>
        )}
        {activeTab === 'schedule' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-6">This Week's Practice Schedule</h2>

            {/* Warm Up Section */}
            <div className="mb-6 p-4 bg-orange-50 rounded-lg">
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-2">🔥</span>
                <h3 className="font-semibold text-gray-800">Warm Up</h3>
              </div>
              <textarea
                value={scheduleForm.warmUp.description}
                onChange={(e) => handleScheduleChange('warmUp', 'description', e.target.value)}
                placeholder="e.g., C major scale, both hands, 2 octaves"
                className="w-full p-3 border border-gray-300 rounded-lg mb-2"
                rows="2"
              />
              <div className="flex items-center">
                <label className="text-sm text-gray-600 mr-2">Duration:</label>
                <input
                  type="number"
                  value={scheduleForm.warmUp.duration}
                  onChange={(e) => handleScheduleChange('warmUp', 'duration', parseInt(e.target.value))}
                  className="w-20 p-2 border border-gray-300 rounded"
                  min="1"
                />
                <span className="text-sm text-gray-600 ml-2">minutes</span>
              </div>
            </div>

            {/* Technical Section */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-2">⚙️</span>
                <h3 className="font-semibold text-gray-800">Technical Work</h3>
              </div>
              <textarea
                value={scheduleForm.technical.description}
                onChange={(e) => handleScheduleChange('technical', 'description', e.target.value)}
                placeholder="e.g., Hanon exercises No. 1-3, focus on finger independence"
                className="w-full p-3 border border-gray-300 rounded-lg mb-2"
                rows="2"
              />
              <div className="flex items-center">
                <label className="text-sm text-gray-600 mr-2">Duration:</label>
                <input
                  type="number"
                  value={scheduleForm.technical.duration}
                  onChange={(e) => handleScheduleChange('technical', 'duration', parseInt(e.target.value))}
                  className="w-20 p-2 border border-gray-300 rounded"
                  min="1"
                />
                <span className="text-sm text-gray-600 ml-2">minutes</span>
              </div>
            </div>

            {/* Repertoire Section */}
            <div className="mb-6 p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center mb-3">
                <span className="text-2xl mr-2">🎵</span>
                <h3 className="font-semibold text-gray-800">Repertoire</h3>
              </div>
              <textarea
                value={scheduleForm.repertoire.description}
                onChange={(e) => handleScheduleChange('repertoire', 'description', e.target.value)}
                placeholder="e.g., Beethoven Sonata Op.13, bars 1-20, hands separate first"
                className="w-full p-3 border border-gray-300 rounded-lg mb-2"
                rows="3"
              />
              <div className="flex items-center">
                <label className="text-sm text-gray-600 mr-2">Duration:</label>
                <input
                  type="number"
                  value={scheduleForm.repertoire.duration}
                  onChange={(e) => handleScheduleChange('repertoire', 'duration', parseInt(e.target.value))}
                  className="w-20 p-2 border border-gray-300 rounded"
                  min="1"
                />
                <span className="text-sm text-gray-600 ml-2">minutes</span>
              </div>
            </div>

            {/* General Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes for the student
              </label>
              <textarea
                value={scheduleForm.notes}
                onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                placeholder="Any additional guidance or focus areas for this week..."
                className="w-full p-3 border border-gray-300 rounded-lg"
                rows="3"
              />
            </div>

            <button
              onClick={handleSaveSchedule}
              disabled={isSavingSchedule}
              className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {isSavingSchedule ? "Saving..." : "Save Schedule"}
            </button>
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">Assignments</h2>
              <button
                onClick={() => setShowAssignmentModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition"
              >
                + New Assignment
              </button>
            </div>

            {assignments.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-5xl mb-4">📋</div>
                <p className="text-gray-600">No assignments yet</p>
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

        {/* Quick Actions */}
        <div className="mt-8 space-y-4">
          <button
            onClick={() => setShowMessageModal(true)}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
          >
            Send Message to {student?.name}
          </button>
          <button
            onClick={() => setShowAssignmentModal(true)}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Assign Practice Assignment
          </button>
        </div>
      </div>

      {/* Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Send Message</h2>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Type your message here..."
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
              rows="5"
            />
            <div className="flex space-x-3">
              <button
                onClick={() => setShowMessageModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                disabled={sendingMessage}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
              >
                {sendingMessage ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Create Assignment</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assignment Title *
                </label>
                <input
                  type="text"
                  value={assignmentForm.title}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                  placeholder="e.g., Bach Prelude in C Major"
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={assignmentForm.description}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })}
                  placeholder="Add notes about the assignment..."
                  className="w-full p-2 border border-gray-300 rounded-lg"
                  rows="3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date *
                </label>
                <input
                  type="date"
                  value={assignmentForm.dueDate}
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, dueDate: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowAssignmentModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendAssignment}
                disabled={sendingAssignment}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {sendingAssignment ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StudentDetail;