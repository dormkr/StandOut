import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Loading from "./components/common/Loading";

// Auth pages
import Login from "./pages/auth/Login";
import SignUp from "./pages/auth/SignUp";

// Teacher pages
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import AddStudent from "./pages/teacher/AddStudent";
import StudentDetail from "./pages/teacher/StudentDetail";

// Student pages
import StudentDashboard from "./pages/student/StudentDashboard";
import PracticeSession from "./pages/student/PracticeSession";

function AppRoutes() {
  const { user, role, loading } = useAuth();

  if (loading) return <Loading />;

  return (
    <Routes>
      {/* Public routes - but redirect if already logged in */}
      <Route
        path="/login"
        element={
          user ? (
            role === "teacher" ? (
              <Navigate to="/teacher" replace />
            ) : (
              <Navigate to="/student" replace />
            )
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/signup"
        element={
          user ? (
            role === "teacher" ? (
              <Navigate to="/teacher" replace />
            ) : (
              <Navigate to="/student" replace />
            )
          ) : (
            <SignUp />
          )
        }
      />

      {/* Teacher routes */}
      <Route
        path="/teacher"
        element={role === "teacher" ? <TeacherDashboard /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/teacher/add-student"
        element={role === "teacher" ? <AddStudent /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/teacher/student/:studentId"
        element={role === "teacher" ? <StudentDetail /> : <Navigate to="/login" replace />}
      />

      {/* Student routes */}
      <Route
        path="/student"
        element={role === "student" ? <StudentDashboard /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/student/practice"
        element={role === "student" ? <PracticeSession /> : <Navigate to="/login" replace />}
      />

      {/* Home/Landing page */}
      <Route
        path="/"
        element={
          user ? (
            role === "teacher" ? (
              <Navigate to="/teacher" replace />
            ) : (
              <Navigate to="/student" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Default redirect */}
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}

function App() {
  return <AppRoutes />;
}

export default App;