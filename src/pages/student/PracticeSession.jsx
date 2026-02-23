import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../hooks/useAuth";
import Metronome from "../../components/student/Metronome";

function PracticeSession() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [schedule, setSchedule] = useState(null);
  const [practiceMode, setPracticeMode] = useState('self-paced'); // Default to self-paced so buttons appear
  const [currentSection, setCurrentSection] = useState('warmUp');
  const [sessionNotes, setSessionNotes] = useState('');
  const [sectionNotes, setSectionNotes] = useState({ warmUp: '', technical: '', repertoire: '' });
  const [completedSections, setCompletedSections] = useState({ warmUp: false, technical: false, repertoire: false });
  const [loading, setLoading] = useState(true);
  const [showMetronome, setShowMetronome] = useState(false);
  const [toast, setToast] = useState(null);
  const [timers, setTimers] = useState({ warmUp: 0, technical: 0, repertoire: 0 });
  const [activeTimers, setActiveTimers] = useState({ warmUp: false, technical: false, repertoire: false });
  const [streak, setStreak] = useState({ current: 0, best: 0, lastPracticeDate: null });
  
  // For self-paced schedule builder
  const [showScheduleBuilder, setShowScheduleBuilder] = useState(false);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    warmUp: { description: '', duration: 10 },
    technical: { description: '', duration: 15 },
    repertoire: { description: '', duration: 20 },
    notes: ''
  });
  // Debug logs shown in UI to capture runtime info without opening devtools
  const [debugLogs, setDebugLogs] = useState([]);
  const pushDebug = (msg) => {
    setDebugLogs((d) => [...d.slice(-30), `${new Date().toLocaleTimeString()}: ${msg}`]);
    try { console.log(msg); } catch (e) {}
  };

  useEffect(() => {
    if (user) {
      loadSchedule();
      loadStreak();
    } else {
      // No user yet, stop loading state so UI doesn't get stuck
      setLoading(false);
    }
    
    // Safety timeout - if still loading after 3 seconds, show content anyway
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3000);
    
    return () => clearTimeout(timeout);
  }, [user]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e) => {
      const sections = ['warmUp', 'technical', 'repertoire'];
      const currentIndex = sections.indexOf(currentSection);
      
      if (e.key === 'ArrowRight' && currentIndex < sections.length - 1) {
        setCurrentSection(sections[currentIndex + 1]);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentSection(sections[currentIndex - 1]);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentSection]);

  // Timer intervals
  useEffect(() => {
    const intervals = {};
    
    Object.keys(activeTimers).forEach((section) => {
      if (activeTimers[section]) {
        intervals[section] = setInterval(() => {
          setTimers(prev => ({
            ...prev,
            [section]: prev[section] + 1
          }));
        }, 1000);
      }
    });

    return () => {
      Object.values(intervals).forEach(clearInterval);
    };
  }, [activeTimers]);

  const loadSchedule = async () => {
    try {
      if (!user) {
        // nothing to load
        setLoading(false);
        return;
      }
      // Get user's practice mode
      const userDoc = await getDoc(doc(db, "users", user.uid));
      let mode = 'teacher-guided';
      if (userDoc.exists()) {
        const userData = userDoc.data();
        mode = userData.practiceMode || 'teacher-guided';
        setPracticeMode(mode);
      }

      const weekStart = getWeekStart();
      const schedulesQuery = query(
        collection(db, "practiceSchedules"),
        where("studentId", "==", user.uid),
        where("week", "==", weekStart)
      );
      const scheduleDocs = await getDocs(schedulesQuery);
      
      if (!scheduleDocs.empty) {
        // If multiple schedules exist (teacher + self-paced), choose based on mode
        let selectedSchedule = null;
        
        if (scheduleDocs.docs.length > 1) {
          // Multiple schedules - choose based on mode
          selectedSchedule = scheduleDocs.docs.find(doc => {
            const data = doc.data();
            if (mode === 'self-paced') {
              return data.teacherId === null || data.teacherId === undefined;
            } else {
              return data.teacherId !== null && data.teacherId !== undefined;
            }
          });
          
          // Fallback to first if none match mode
          if (!selectedSchedule) {
            selectedSchedule = scheduleDocs.docs[0];
          }
        } else {
          selectedSchedule = scheduleDocs.docs[0];
        }
        
        const scheduleData = { id: selectedSchedule.id, ...selectedSchedule.data() };
        setSchedule(scheduleData);
        
        // Set initial completion status
        setCompletedSections({
          warmUp: scheduleData.sections?.warmUp?.completed || false,
          technical: scheduleData.sections?.technical?.completed || false,
          repertoire: scheduleData.sections?.repertoire?.completed || false
        });

        // Populate schedule form if self-paced
        if (mode === 'self-paced') {
          setScheduleForm({
            warmUp: scheduleData.sections?.warmUp || { description: '', duration: 10 },
            technical: scheduleData.sections?.technical || { description: '', duration: 15 },
            repertoire: scheduleData.sections?.repertoire || { description: '', duration: 20 },
            notes: scheduleData.notes || ''
          });
        }
      }
    } catch (error) {
      console.error("Error loading schedule:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStreak = async () => {
    try {
      if (!user) return;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setStreak({
          current: userData.streakCurrent || 0,
          best: userData.streakBest || 0,
          lastPracticeDate: userData.lastPracticeDate ? new Date(userData.lastPracticeDate).toDateString() : null
        });
      }
    } catch (error) {
      console.error("Error loading streak:", error);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day;
    const monday = new Date(now.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTimer = (section) => {
    setActiveTimers(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const resetTimer = (section) => {
    setTimers(prev => ({
      ...prev,
      [section]: 0
    }));
    setActiveTimers(prev => ({
      ...prev,
      [section]: false
    }));
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
    pushDebug("Save schedule clicked!");
    setIsSavingSchedule(true);
    try {
      pushDebug("Schedule form: " + JSON.stringify(scheduleForm));
      pushDebug("User: " + (user?.uid || 'no-user'));
      
      // Validate that user exists
      if (!user || !user.uid) {
        console.error("User not authenticated!");
        showToast("Error: You are not logged in", 'error');
        setIsSavingSchedule(false);
        return;
      }

      const weekStart = getWeekStart();
      console.log("Week start:", weekStart);
      
      const scheduleData = {
        teacherId: null, // Self-paced
        studentId: user.uid,
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

      let savedScheduleId = null;

      if (schedule) {
        // Update existing
        pushDebug("Updating existing schedule: " + schedule.id);
        await updateDoc(doc(db, "practiceSchedules", schedule.id), scheduleData);
        savedScheduleId = schedule.id;
      } else {
        // Create new
        pushDebug("Creating new schedule");
        const docRef = await addDoc(collection(db, "practiceSchedules"), scheduleData);
        savedScheduleId = docRef.id;
        pushDebug("New schedule created with ID: " + savedScheduleId);
      }

      // Directly set the schedule state with the saved data
      pushDebug("Setting schedule state");
      setSchedule({
        id: savedScheduleId,
        ...scheduleData
      });

      pushDebug("Showing toast and closing modal");
      showToast("✓ Schedule created successfully!");
      setShowScheduleBuilder(false);
      setCompletedSections({
        warmUp: false,
        technical: false,
        repertoire: false
      });
      setIsSavingSchedule(false);
    } catch (error) {
      const errorMsg = error?.message || String(error);
      pushDebug("Error saving schedule: " + errorMsg);
      console.error("Error saving schedule:", error);
      console.error("Error stack:", error?.stack);
      showToast("Error saving schedule: " + errorMsg, 'error');
      setIsSavingSchedule(false);
    }
  };

  const handleMarkComplete = async (section) => {
    const newCompletedSections = {
      ...completedSections,
      [section]: !completedSections[section]
    };
    setCompletedSections(newCompletedSections);

    // Update in Firestore
    try {
      await updateDoc(doc(db, "practiceSchedules", schedule.id), {
        [`sections.${section}.completed`]: newCompletedSections[section]
      });
    } catch (error) {
      console.error("Error updating completion:", error);
    }
  };

  const handleFinishSession = async () => {
    try {
      // Calculate total duration
      const totalDuration = Object.keys(completedSections).reduce((sum, section) => {
        if (completedSections[section] && schedule.sections[section]) {
          return sum + schedule.sections[section].duration;
        }
        return sum;
      }, 0);

      // Calculate streak
      const today = new Date().toDateString();
      const isNewDay = streak.lastPracticeDate !== today;
      
      // Check if today is consecutive from yesterday
      const isConsecutiveDay = streak.lastPracticeDate ? (() => {
        const lastDate = new Date(streak.lastPracticeDate);
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return lastDate.toDateString() === yesterday.toDateString();
      })() : false;

      let newCurrent = isNewDay ? (isConsecutiveDay ? streak.current + 1 : 1) : streak.current;
      let newBest = newCurrent > streak.best ? newCurrent : streak.best;

      // Create practice log
      await addDoc(collection(db, "practiceLogs"), {
        studentId: user.uid,
        date: new Date(),
        duration: totalDuration,
        actualTime: Object.values(timers).reduce((a, b) => a + b, 0),
        sections: completedSections,
        sectionTimers: timers,
        notes: sessionNotes,
        sectionNotes: sectionNotes
      });

      // Update user streak
      await updateDoc(doc(db, "users", user.uid), {
        streakCurrent: newCurrent,
        streakBest: newBest,
        lastPracticeDate: today
      });

      showToast(`✓ Practice session logged! Streak: ${newCurrent} days 🔥`);
      setTimeout(() => navigate('/student'), 1500);
    } catch (error) {
      console.error("Error logging practice:", error);
      showToast("Error saving practice log", 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600">Loading...</div>
          <div className="text-xs text-gray-500 mt-4">Loading: {String(loading)} | User: {user?.uid ? 'yes' : 'no'} | Mode: {practiceMode}</div>
        </div>
      </div>
    );
  }

  if (!schedule) {
    const showDebug = true;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          {showDebug && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded text-left text-sm">
              <div className="font-bold mb-2">DEBUG</div>
              <div>schedule: {String(Boolean(schedule))}</div>
              <div>practiceMode: {practiceMode}</div>
              <div>loading: {String(loading)}</div>
              <div>user: {user?.uid ? user.uid.substring(0, 8) + '...' : 'none'}</div>
              <div>showScheduleBuilder: {String(showScheduleBuilder)}</div>
            </div>
          )}
          {practiceMode === 'self-paced' ? (
            <div>
              <p className="text-gray-600 mb-6">No practice schedule for this week yet.</p>
              <button
                onClick={() => {
                  pushDebug("CREATE SCHEDULE button clicked!");
                  console.log("CREATE SCHEDULE button clicked!");
                  setShowScheduleBuilder(true);
                }}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold mb-4"
              >
                Create Your Schedule 📋
              </button>
              <button
                onClick={() => navigate('/student')}
                className="block mx-auto mt-4 text-gray-600 hover:text-gray-800"
              >
                Back to Dashboard
              </button>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-4">No practice schedule available for this week.</p>
              <p className="text-sm text-gray-500 mb-6">Ask your teacher to create a schedule for you.</p>
              <button
                onClick={() => navigate('/student')}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show schedule builder for self-paced mode
  console.log("Modal render check:", { showScheduleBuilder, practiceMode, shouldShow: showScheduleBuilder && practiceMode === 'self-paced' });
  if (showScheduleBuilder && practiceMode === 'self-paced') {
    console.log("RENDERING MODAL");
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Create Your Practice Schedule</h1>
            <p className="text-gray-600 mb-6">Set up your weekly practice routine</p>
            
            {/* Debug info */}
            <div className="bg-yellow-50 p-3 rounded mb-4 text-xs text-yellow-800">
              DEBUG: Schedule builder open. Practice mode: {practiceMode}
            </div>
            {debugLogs.length > 0 && (
              <div className="bg-gray-100 border border-gray-200 rounded p-3 mb-4 text-xs text-gray-700 max-h-40 overflow-auto">
                <div className="font-semibold text-sm mb-2">Live debug</div>
                {debugLogs.slice().reverse().map((l, i) => (
                  <div key={i} className="leading-tight">{l}</div>
                ))}
              </div>
            )}

            <div className="space-y-6">
              {['warmUp', 'technical', 'repertoire'].map((section) => (
                <div key={section} className="border-l-4 border-purple-500 pl-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    {section === 'warmUp' ? '🔥 Warm Up' : section === 'technical' ? '⚙️ Technical Work' : '🎵 Repertoire'}
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        What to practice:
                      </label>
                      <textarea
                        value={scheduleForm[section].description}
                        onChange={(e) => handleScheduleChange(section, 'description', e.target.value)}
                        placeholder="e.g., Scales, chord progressions, etc."
                        className="w-full p-3 border border-gray-300 rounded-lg"
                        rows="2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Duration (minutes):
                      </label>
                      <input
                        type="number"
                        value={scheduleForm[section].duration}
                        onChange={(e) => handleScheduleChange(section, 'duration', Number(e.target.value))}
                        min="5"
                        max="120"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  General Notes (optional):
                </label>
                <textarea
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  placeholder="Any additional notes or reminders..."
                  className="w-full p-3 border border-gray-300 rounded-lg"
                  rows="3"
                />
              </div>
            </div>

            <div className="flex space-x-4 mt-8">
              <button
                onClick={handleSaveSchedule}
                disabled={isSavingSchedule}
                className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed transition active:scale-95"
              >
                {isSavingSchedule ? "Saving..." : "Save Schedule ✓"}
              </button>
              <button
                onClick={() => setShowScheduleBuilder(false)}
                disabled={isSavingSchedule}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const sections = ['warmUp', 'technical', 'repertoire'];
  const sectionInfo = {
    warmUp: { emoji: '🔥', label: 'Warm Up', color: 'orange' },
    technical: { emoji: '⚙️', label: 'Technical Work', color: 'blue' },
    repertoire: { emoji: '🎵', label: 'Repertoire', color: 'purple' }
  };

  const currentSectionData = schedule.sections[currentSection];
  const currentInfo = sectionInfo[currentSection];
  const currentIndex = sections.indexOf(currentSection);

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

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/student')}
            className="text-gray-600 hover:text-gray-800 mb-2"
          >
            ← Back to Dashboard
          </button>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Practice Session</h1>
            {streak.current > 0 && (
              <div className="text-right">
                <div className="text-2xl font-bold text-red-500">{streak.current} 🔥</div>
                <div className="text-xs text-gray-600">day streak (best: {streak.best})</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            {sections.map((section, index) => (
              <div key={section} className="flex items-center">
                <button
                  onClick={() => setCurrentSection(section)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                    currentSection === section
                      ? `bg-${sectionInfo[section].color}-100 text-${sectionInfo[section].color}-700`
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-2xl">{sectionInfo[section].emoji}</span>
                  <span className="font-medium text-sm">{sectionInfo[section].label}</span>
                  {completedSections[section] && <span className="text-green-600">✓</span>}
                </button>
                {index < sections.length - 1 && (
                  <div className="w-8 h-0.5 bg-gray-300 mx-2"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
          {/* Section Header */}
          <div className="text-center mb-8">
            <span className="text-6xl mb-4 block">{currentInfo.emoji}</span>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">{currentInfo.label}</h2>
            <div className="text-2xl text-gray-600 font-semibold">
              {currentSectionData.duration} minutes
            </div>

            {/* Timer Display */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg inline-block">
              <div className="text-4xl font-mono font-bold text-blue-600 mb-2">
                {formatTime(timers[currentSection])}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => toggleTimer(currentSection)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
                >
                  {activeTimers[currentSection] ? '⏸ Pause' : '▶ Start'}
                </button>
                <button
                  onClick={() => resetTimer(currentSection)}
                  className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500 text-sm font-medium"
                >
                  🔄 Reset
                </button>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-2">What to practice:</h3>
            <p className="text-gray-700">{currentSectionData.description}</p>
          </div>

          {/* Teacher Feedback */}
          {schedule.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-yellow-900 mb-2">💬 Teacher's Notes:</h3>
              <p className="text-yellow-800">{schedule.notes}</p>
            </div>
          )}

          {/* Metronome Toggle */}
          <div className="mb-6">
            <button
              onClick={() => setShowMetronome(!showMetronome)}
              className="w-full px-6 py-3 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium"
            >
              {showMetronome ? '🎵 Hide Metronome' : '🎵 Show Metronome'}
            </button>
            
            {showMetronome && (
              <div className="mt-4">
                <Metronome />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes for this section:
            </label>
            <textarea
              value={sectionNotes[currentSection]}
              onChange={(e) => setSectionNotes({
                ...sectionNotes,
                [currentSection]: e.target.value
              })}
              placeholder="Any challenges, observations, or questions..."
              className="w-full p-3 border border-gray-300 rounded-lg"
              rows="3"
            />
          </div>

          {/* Mark Complete */}
          <button
            onClick={() => handleMarkComplete(currentSection)}
            className={`w-full py-4 rounded-lg font-semibold text-lg mb-4 ${
              completedSections[currentSection]
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {completedSections[currentSection] ? '✓ Completed' : 'Mark as Complete'}
          </button>

          {/* Navigation */}
          <div className="flex space-x-3 mb-4">
            {currentIndex > 0 && (
              <button
                onClick={() => setCurrentSection(sections[currentIndex - 1])}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                ← Previous (←)
              </button>
            )}
            {currentIndex < sections.length - 1 ? (
              <button
                onClick={() => setCurrentSection(sections[currentIndex + 1])}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              >
                Next (→) →
              </button>
            ) : (
              <button
                onClick={handleFinishSession}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm"
              >
                Finish Session ✓
              </button>
            )}
          </div>

          {/* Keyboard Hint */}
          <div className="text-xs text-gray-500 text-center mb-6">
            💡 Tip: Use ← → arrow keys to navigate between sections
          </div>

          {/* Edit Schedule Button for Self-Paced */}
          {practiceMode === 'self-paced' && (
            <button
              onClick={() => setShowScheduleBuilder(true)}
              className="w-full px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              ✏️ Edit This Week's Schedule
            </button>
          )}
        </div>

        {/* Session Notes */}
        <div className="bg-white rounded-lg shadow-sm p-6 mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Overall session notes:
          </label>
          <textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="How did the practice session go overall?"
            className="w-full p-3 border border-gray-300 rounded-lg"
            rows="3"
          />
        </div>
      </div>
    </div>
  );
}

export default PracticeSession;