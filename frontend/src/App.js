import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function App() {
  // Navigation: 'website' or 'portal'
  const [currentView, setCurrentView] = useState('website');
  const [themeMode, setThemeMode] = useState(() => (
    window.localStorage.getItem('school-system-theme') === 'dark' ? 'dark' : 'light'
  ));
  
  // Website Pages: 'home', 'about', 'facilities', 'admission-form', 'contact'
  const [webPage, setWebPage] = useState('home');

  // Portal Tabs: 'dashboard', 'students', 'attendance', 'fees', 'reports', 'notices'
  const [portalTab, setPortalTab] = useState('dashboard');
  
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'admin' or 'teacher'
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginRoleInput, setLoginRoleInput] = useState('admin');
  const [loginPasswordInput, setLoginPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Core States
  const [students, setStudents] = useState([]);
  const [pendingStudents, setPendingStudents] = useState([]);
  const [notices, setNotices] = useState([]);
  const [newNotice, setNewNotice] = useState({ title: '', desc: '' });

  // Classes offered from Nursery to 6th
  const classList = ['Nursery', 'LKG', 'UKG', '1st Class', '2nd Class', '3rd Class', '4th Class', '5th Class', '6th Class'];

  // Add / Edit Student State
  const [newStudent, setNewStudent] = useState({ rollNo: '', name: '', standard: 'LKG', parentName: '', parentPhone: '', totalFee: '', paidFee: '' });
  const [editingStudent, setEditingStudent] = useState(null);

  // Admission Enquiry Form State (Public)
  const [enquiryForm, setEnquiryForm] = useState({ studentName: '', parentName: '', phone: '', grade: 'LKG', message: '' });
  const [enquirySuccess, setEnquirySuccess] = useState(false);

  // Attendance State
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceClass, setAttendanceClass] = useState('LKG');
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [attendanceStatusMsg, setAttendanceStatusMsg] = useState('');

  // Report Card State
  const [selectedStudent, setSelectedStudent] = useState(null);
  const reportRef = useRef();

  const loadData = () => {
    axios.get('http://localhost:5000/api/students').then(res => {
      setStudents(res.data);
      const initial = {};
      res.data.forEach(s => { initial[s._id] = 'Present'; });
      setAttendanceRecords(initial);
    }).catch(console.error);

    axios.get('http://localhost:5000/api/fees/pending').then(res => setPendingStudents(res.data)).catch(console.error);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    window.localStorage.setItem('school-system-theme', themeMode);
  }, [themeMode]);

  const totalOutstanding = pendingStudents.reduce(
    (acc, s) => acc + Math.max(0, (Number(s.totalFee) || 0) - (Number(s.paidFee) || 0)),
    0
  );
  const totalFeesCollected = students.reduce((acc, s) => acc + (Number(s.paidFee) || 0), 0);
  const attendanceClassStudents = students.filter(s => s.standard === attendanceClass);
  const presentCount = attendanceClassStudents.filter(s => (attendanceRecords[s._id] || 'Present') === 'Present').length;
  const absentCount = attendanceClassStudents.length - presentCount;
  const reportSubjectMarks = selectedStudent ? [
    Number(selectedStudent.marks?.telugu) || 0,
    Number(selectedStudent.marks?.english) || 0,
    Number(selectedStudent.marks?.maths) || 0,
    Number(selectedStudent.marks?.science) || 0,
    Number(selectedStudent.marks?.social) || 0
  ] : [];
  const reportTotal = reportSubjectMarks.reduce((total, marks) => total + marks, 0);
  const reportAverage = reportSubjectMarks.length ? (reportTotal / reportSubjectMarks.length).toFixed(1) : '0.0';

  // Handle Login Authentication
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setLoginError('');

    if (loginRoleInput === 'admin' && loginPasswordInput === 'admin123') {
      setUserRole('admin');
      setIsAuthenticated(true);
      setShowLoginModal(false);
      setLoginPasswordInput('');
      setCurrentView('portal');
    } else if (loginRoleInput === 'teacher' && loginPasswordInput === 'teacher123') {
      setUserRole('teacher');
      setIsAuthenticated(true);
      setShowLoginModal(false);
      setLoginPasswordInput('');
      setCurrentView('portal');
    } else {
      setLoginError('Incorrect password! Please try again.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUserRole(null);
    setCurrentView('website');
  };

  // Public Admission Form Submit
  const handleEnquirySubmit = (e) => {
    e.preventDefault();
    setEnquirySuccess(true);
    setTimeout(() => {
      setEnquirySuccess(false);
      setEnquiryForm({ studentName: '', parentName: '', phone: '', grade: 'LKG', message: '' });
    }, 4000);
  };

  // Add New Student (Admin)
  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (userRole !== 'admin') return alert('Admin access required.');
    try {
      await axios.post('http://localhost:5000/api/students', {
        rollNo: String(newStudent.rollNo).trim(),
        name: newStudent.name.trim(),
        standard: newStudent.standard,
        parentName: newStudent.parentName.trim(),
        parentPhone: String(newStudent.parentPhone).trim(),
        totalFee: Number(newStudent.totalFee) || 0,
        paidFee: Number(newStudent.paidFee) || 0,
        marks: { telugu: 85, english: 80, maths: 90, science: 85, social: 80 }
      });
      setNewStudent({ rollNo: '', name: '', standard: 'LKG', parentName: '', parentPhone: '', totalFee: '', paidFee: '' });
      loadData();
      alert('Student Enrolled Successfully! ✅');
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || 'Error adding student. Make sure Roll No is unique and Server is running.');
    }
  };

  // Excel Bulk Upload (Admin)
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post('http://localhost:5000/api/students/upload-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Excel Students Data Imported Successfully! 📊✅');
      loadData();
    } catch (err) {
      alert('Failed to upload Excel: ' + (err.response?.data?.error || err.message));
    }
  };

  // Update Student (Admin)
  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:5000/api/students/${editingStudent._id}`, editingStudent);
      setEditingStudent(null);
      loadData();
      alert('Student Updated! ✅');
    } catch (err) {
      alert('Failed to update student');
    }
  };

  // Delete Student (Admin)
  const handleDeleteStudent = async (id) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        await axios.delete(`http://localhost:5000/api/students/${id}`);
        loadData();
      } catch (err) {
        alert('Failed to delete');
      }
    }
  };

  // WhatsApp Fee Due Alert
  const sendWhatsApp = (student) => {
    const due = student.totalFee - student.paidFee;
    const msg = encodeURIComponent(
      `Dear ${student.parentName}, this is an official fee reminder from SRI BHARATHI EM SCHOOL, NAGASAMUDRAM: Pending fee for ${student.name} (${student.standard}) is Rs. ${due}/-. Please clear the balance at your earliest convenience.`
    );
    window.open(`https://wa.me/91${student.parentPhone}?text=${msg}`, '_blank');
  };

  // WhatsApp Absent Alert to Parent
  const sendAbsentAlert = (student) => {
    const message = encodeURIComponent(
      `🔔 SRI BHARATHI EM SCHOOL, NAGASAMUDRAM\n\nDear ${student.parentName},\nThis is to inform you that your child ${student.name} (Roll No: ${student.rollNo}, Class: ${student.standard}) is marked ABSENT today (${attendanceDate}).\n\nIf this was not planned, please contact the school office: +91 98765 43210.`
    );
    window.open(`https://wa.me/91${student.parentPhone}?text=${message}`, '_blank');
  };

  // Save Attendance
  const saveAttendance = async () => {
    const records = students
      .filter(s => s.standard === attendanceClass)
      .map(s => ({
        studentId: s._id,
        rollNo: s.rollNo,
        name: s.name,
        status: attendanceRecords[s._id] || 'Present'
      }));

    try {
      setAttendanceStatusMsg('Saving...');
      await axios.post('http://localhost:5000/api/attendance', {
        date: attendanceDate,
        standard: attendanceClass,
        records
      });
      setAttendanceStatusMsg('Attendance Saved Successfully! ✅');
      setTimeout(() => setAttendanceStatusMsg(''), 3000);
    } catch {
      setAttendanceStatusMsg('Failed to save attendance.');
    }
  };

  // Add Notice
  const handleAddNotice = (e) => {
    e.preventDefault();
    if (!newNotice.title || !newNotice.desc) return;
    setNotices([{ id: Date.now(), title: newNotice.title, desc: newNotice.desc, date: new Date().toISOString().split('T')[0] }, ...notices]);
    setNewNotice({ title: '', desc: '' });
  };

  // Download PDF Report Card
  const downloadPDF = () => {
    html2canvas(reportRef.current, { scale: 2 }).then(canvas => {
      const pdf = new jsPDF('p', 'mm', 'a4');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, 190, 0);
      pdf.save(`${selectedStudent.name}_ProgressReport.pdf`);
    });
  };

  return (
    <div className={`app-shell theme-${themeMode}`} style={{ minHeight: '100vh', fontFamily: "'Segoe UI', Roboto, sans-serif", background: '#f8fafc', color: '#1e293b' }}>
      
      {/* GLOBAL TOP NAV HEADER */}
      <header style={{ background: '#0f172a', color: '#fff', padding: '0 32px', height: '75px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }} onClick={() => setCurrentView('website')}>
          <span style={{ fontSize: '32px' }}>🏫</span>
          <div>
            <h1 style={{ 
              margin: 0, 
              fontSize: '20px', 
              fontWeight: '900', 
              letterSpacing: '0.8px', 
              color: '#facc15',
              textShadow: '0 2px 4px rgba(0,0,0,0.5)'
            }}>
              SRI BHARATHI EM SCHOOL
            </h1>
            <small style={{ color: '#38bdf8', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px' }}>
              📍 NAGASAMUDRAM | Nursery to 6th Class
            </small>
          </div>
        </div>

        {/* Top Navigation Switcher */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
            aria-pressed={themeMode === 'dark'}
            title="Change color theme"
            style={{ background: themeMode === 'dark' ? '#334155' : '#1e293b', color: '#fff', border: '1px solid #475569', padding: '9px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}
          >
            {themeMode === 'dark' ? '☀️ Light mode' : '🌙 Dark mode'}
          </button>
          {currentView === 'website' ? (
            <>
              {['home', 'about', 'facilities', 'admission-form', 'contact'].map(p => (
                <button
                  key={p}
                  onClick={() => setWebPage(p)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: webPage === p ? '#38bdf8' : '#cbd5e1',
                    fontSize: '14px',
                    fontWeight: webPage === p ? '700' : '500',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    padding: '8px 12px'
                  }}
                >
                  {p.replace('-', ' ')}
                </button>
              ))}
              
              <button 
                onClick={() => {
                  if (isAuthenticated) {
                    setCurrentView('portal');
                  } else {
                    setShowLoginModal(true);
                  }
                }}
                style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '10px' }}
              >
                🔐 Staff & Admin Login
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => setCurrentView('website')}
                style={{ background: '#334155', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
              >
                🌐 Public Website
              </button>
              
              <span style={{ background: '#1e293b', padding: '6px 12px', borderRadius: '4px', color: userRole === 'admin' ? '#38bdf8' : '#4ade80', fontWeight: 'bold', fontSize: '13px', border: '1px solid #334155' }}>
                {userRole === 'admin' ? '🛡️ Admin Account' : '👨‍🏫 Teacher Account'}
              </span>

              <button 
                onClick={handleLogout}
                style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                🚪 Logout
              </button>
            </>
          )}
        </div>
      </header>

      {/* LOGIN POPUP MODAL */}
      {showLoginModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '380px', padding: '32px', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)', border: '1px solid #e2e8f0' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <span style={{ fontSize: '36px' }}>🔐</span>
              <h2 style={{ margin: '8px 0 4px 0', fontSize: '20px', color: '#0f172a' }}>SRI BHARATHI EM SCHOOL</h2>
              <small style={{ color: '#64748b' }}>Enter credentials to access Portal</small>
            </div>

            {loginError && (
              <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px', textAlign: 'center', fontWeight: '600' }}>
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Select Account Role:</label>
                <select 
                  value={loginRoleInput} 
                  onChange={e => setLoginRoleInput(e.target.value)}
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', background: '#f8fafc' }}
                >
                  <option value="admin">🛡️ Administrator (Full Access)</option>
                  <option value="teacher">👨‍🏫 Staff / Teacher (Attendance & Reports)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Password:</label>
                <input 
                  type="password" 
                  placeholder={loginRoleInput === 'admin' ? 'Default: admin123' : 'Default: teacher123'}
                  value={loginPasswordInput} 
                  onChange={e => setLoginPasswordInput(e.target.value)} 
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                  required 
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => { setShowLoginModal(false); setLoginError(''); setLoginPasswordInput(''); }}
                  style={{ flex: 1, background: '#e2e8f0', color: '#475569', border: 'none', padding: '11px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', padding: '11px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Login ➡️
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. PUBLIC WEBSITE SECTION */}
      {/* ========================================================================= */}
      {currentView === 'website' && (
        <div>
          {webPage === 'home' && (
            <div>
              <section className="home-hero">
                <div className="home-hero-content">
                  <span className="home-eyebrow">Learning starts with a strong foundation</span>
                  <p className="home-location">📍 NAGASAMUDRAM · ANDHRA PRADESH</p>
                  <h1>SRI BHARATHI <span>E.M. SCHOOL</span></h1>
                  <p className="home-hero-copy">
                    English Medium education from Nursery to 6th Class. A place to practise essential skills, explore ideas and grow through learning, classroom activities and family partnership.
                  </p>
                  <div className="home-hero-actions">
                    <button className="home-button home-button-primary" onClick={() => setWebPage('admission-form')}>Explore admission enquiry <span aria-hidden="true">→</span></button>
                    <button className="home-button home-button-secondary" onClick={() => setWebPage('about')}>Discover our approach</button>
                  </div>
                  <div className="home-hero-note">For current class availability, school timings and fee details, please contact the school directly.</div>
                </div>
                <div className="home-hero-side" aria-label="School learning highlights">
                  <div className="home-hero-illustration" aria-hidden="true">📚</div>
                  <p className="home-hero-side-label">A learning journey for every stage</p>
                  <p>Nursery <span>→</span> LKG & UKG <span>→</span> Primary classes through 6th</p>
                </div>
              </section>

              <section className="home-facts" aria-label="School overview">
                {[
                  { value: 'Nursery – 6th', label: 'Classes offered', icon: '🎒' },
                  { value: 'English Medium', label: 'Medium of instruction', icon: '🔤' },
                  { value: 'Nagasamudram', label: 'School location', icon: '📍' },
                  { value: 'Learn · Practise · Grow', label: 'Our learning focus', icon: '🌱' }
                ].map((fact, index) => (
                  <article className="home-fact" key={index}>
                    <span className="home-fact-icon" aria-hidden="true">{fact.icon}</span>
                    <div><b>{fact.value}</b><span>{fact.label}</span></div>
                  </article>
                ))}
              </section>

              {/* Highlights */}
              <section className="home-section">
                <div className="home-section-heading">
                  <span className="home-section-kicker">A well-rounded school experience</span>
                  <h2>More than lessons in a classroom</h2>
                  <p>Build learning habits and confidence through foundational subjects, communication, creative practice and positive daily routines.</p>
                </div>
                <div className="home-feature-grid">
                  {[
                    { title: 'Foundational academics', desc: 'Practise reading, writing, language and number skills step by step, with regular opportunities to review and strengthen understanding.', icon: '📖', tag: 'LEARN' },
                    { title: 'English communication', desc: 'Build confidence using English through classroom conversation, clear explanations and opportunities to express ideas.', icon: '💬', tag: 'COMMUNICATE' },
                    { title: 'Creative activities', desc: 'Drawing, puzzles and educational play help students explore ideas, make choices and learn by doing.', icon: '🎨', tag: 'CREATE' },
                    { title: 'Movement & teamwork', desc: 'Games and physical activities give children a chance to practise coordination, cooperation and healthy participation.', icon: '⚽', tag: 'PARTICIPATE' }
                  ].map((f, i) => (
                    <article className="home-feature-card" key={i}>
                      <div className="home-feature-top"><span className="home-feature-icon">{f.icon}</span><span className="home-feature-tag">{f.tag}</span></div>
                      <h3>{f.title}</h3>
                      <p>{f.desc}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="home-learning-section">
                <div className="home-section-heading">
                  <span className="home-section-kicker">Learning at every stage</span>
                  <h2>A journey from first steps to independent thinking</h2>
                  <p>Each age and class brings new opportunities to practise, ask questions and take on greater responsibility for learning.</p>
                </div>
                <div className="home-stage-grid">
                    {[
                      { title: 'Early years', classes: 'Nursery · LKG · UKG', icon: '🌱', details: 'Get comfortable with school routines while exploring letters, sounds, numbers, stories, creative activities and learning through play.' },
                      { title: 'Primary foundations', classes: '1st · 2nd · 3rd Class', icon: '📚', details: 'Strengthen reading, writing and mathematics through explanation, guided practice, revision and opportunities to share ideas.' },
                      { title: 'Growing independence', classes: '4th · 5th · 6th Class', icon: '🔎', details: 'Develop subject understanding, practise problem-solving and learn to explain thinking with greater confidence and responsibility.' }
                    ].map((stage, index) => (
                      <article className="home-stage-card" key={index}>
                        <div className="home-stage-number">0{index + 1}</div>
                        <span className="home-stage-icon" aria-hidden="true">{stage.icon}</span>
                        <h3>{stage.title}</h3>
                        <span className="home-stage-classes">{stage.classes}</span>
                        <p>{stage.details}</p>
                      </article>
                    ))}
                </div>
                <div className="home-inline-action">
                  <button className="home-text-button" onClick={() => setWebPage('about')}>Read about our school and approach <span aria-hidden="true">→</span></button>
                </div>
              </section>

              <section className="home-subject-section">
                <div className="home-subject-copy">
                  <span className="home-section-kicker">What learning includes</span>
                  <h2>Strong basics, one subject at a time</h2>
                  <p>Student progress reports in the portal include these subject areas. The school can confirm the current class-wise syllabus and assessment schedule.</p>
                  <button className="home-text-button" onClick={() => setWebPage('contact')}>Ask the school about the syllabus <span aria-hidden="true">→</span></button>
                </div>
                <div className="home-subject-list">
                  {[
                    { name: 'Telugu', note: 'Language and literacy', icon: ' అ ' },
                    { name: 'English', note: 'Language and communication', icon: 'A' },
                    { name: 'Mathematics', note: 'Numbers and problem-solving', icon: '＋' },
                    { name: 'Science / EVS', note: 'Understanding our world', icon: '🌍' },
                    { name: 'Social / GK', note: 'People, places and general knowledge', icon: '🧭' }
                  ].map(subject => (
                    <div className="home-subject-row" key={subject.name}>
                      <span className="home-subject-icon" aria-hidden="true">{subject.icon}</span>
                      <div><b>{subject.name}</b><span>{subject.note}</span></div>
                      <span className="home-subject-arrow" aria-hidden="true">↗</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="home-family-section">
                <div className="home-family-content">
                  <div>
                    <span className="home-section-kicker">A helpful start for families</span>
                    <h2>Choosing a school is a conversation</h2>
                    <p>We encourage families to ask questions, understand the child's class routine and confirm practical details directly with the school before making an admission decision.</p>
                  </div>
                  <div className="home-family-checklist">
                    {[
                      'Ask whether a seat is available in your preferred class.',
                      'Confirm current fees, timings and documents required.',
                      'Discuss your child’s previous learning or support needs.',
                      'Ask how the school shares notices and progress updates.'
                    ].map((item, index) => (
                      <div className="home-checklist-item" key={index}><span aria-hidden="true">✓</span><p>{item}</p></div>
                    ))}
                  </div>
                </div>
                <div className="home-family-actions">
                  <button className="home-button home-button-primary" onClick={() => setWebPage('admission-form')}>Start an enquiry</button>
                  <button className="home-button home-button-outline" onClick={() => setWebPage('contact')}>Contact the school</button>
                </div>
              </section>

              <section className="home-portal-section">
                <div className="home-portal-heading">
                  <div><span className="home-section-kicker">For enrolled families & staff</span><h2>School updates in one place</h2></div>
                  <p>Staff portal tools support routine school administration. Parents can contact the school directly for official updates and records.</p>
                </div>
                <div className="home-portal-grid">
                  {[
                    { icon: '📅', title: 'Class attendance', detail: 'Staff can mark a class list for a selected school date and review present and absent counts.' },
                    { icon: '📢', title: 'School notices', detail: 'Published announcements can share important dates and reminders with website visitors.' },
                    { icon: '📄', title: 'Progress reports', detail: 'Staff can review recorded subject marks and prepare a printable report card.' }
                  ].map(item => (
                    <article className="home-portal-card" key={item.title}>
                      <span aria-hidden="true">{item.icon}</span><h3>{item.title}</h3><p>{item.detail}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="home-faq-section">
                <div className="home-section-heading">
                  <span className="home-section-kicker">Quick answers</span>
                  <h2>Before you get in touch</h2>
                  <p>Common questions to help families plan the next step.</p>
                </div>
                <div className="home-faq-list">
                  {[
                    { question: 'Which classes are offered?', answer: 'The school website lists classes from Nursery, LKG and UKG through 6th Class. Please contact the school to check current availability for a particular class.' },
                    { question: 'How do I confirm fees, timings and documents?', answer: 'These details can change. Please contact the school directly to get the current fee information, school timings and admission document checklist.' },
                    { question: 'Does the online enquiry form send my details to the school?', answer: 'No. The current form is a demonstration only and does not transmit or store enquiries. Use the phone number on the Contact page to make a real enquiry.' },
                    { question: 'Where can I see official notices?', answer: 'Notices published by staff appear on the website notice board. Confirm time-sensitive information with the school before relying on it.' }
                  ].map((item, index) => (
                    <details className="home-faq-item" key={index}>
                      <summary><span>{item.question}</span><b aria-hidden="true">+</b></summary>
                      <p>{item.answer}</p>
                    </details>
                  ))}
                </div>
              </section>

              <section className="home-visit-callout">
                <div className="home-visit-icon" aria-hidden="true">🏫</div>
                <div>
                  <span className="home-section-kicker">Your next step</span>
                  <h2>Come with questions. Leave with clarity.</h2>
                  <p>Ask about class availability, current fees, school timings and the documents needed for admission. Keeping the preferred class and a parent or guardian contact number ready can help.</p>
                </div>
                <div className="home-visit-actions">
                  <button className="home-button home-button-primary" onClick={() => setWebPage('admission-form')}>Admission information</button>
                  <button className="home-button home-button-outline" onClick={() => setWebPage('contact')}>Contact details</button>
                </div>
              </section>

              {/* Notice Board */}
              <section className="home-notice-section">
                <div className="home-notice-inner">
                  <div className="home-notice-heading">
                    <div><span className="home-section-kicker">Stay informed</span><h2>School notice board</h2></div>
                    <p>Check dates and details with the school when planning around an announcement.</p>
                  </div>
                  <div className="home-notice-list">
                    {notices.length ? notices.map(n => (
                      <article key={n.id} className="home-notice-card">
                        <span className="home-notice-icon" aria-hidden="true">📣</span>
                        <div><div className="home-notice-meta"><b>{n.title}</b><time dateTime={n.date}>{n.date}</time></div><p>{n.desc}</p></div>
                      </article>
                    )) : <p className="home-empty-notices">No notices have been published. Please check back for school updates.</p>}
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ABOUT US */}
          {webPage === 'about' && (
            <section style={{ maxWidth: '1100px', margin: '50px auto', padding: '0 24px', lineHeight: '1.8' }}>
              <div style={{ textAlign: 'center', maxWidth: '820px', margin: '0 auto 34px' }}>
                <span style={{ color: '#2563eb', fontWeight: '700', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>About our school</span>
                <h2 style={{ fontSize: '32px', color: '#0f172a', margin: '8px 0 12px' }}>A supportive place to learn and grow</h2>
                <p style={{ color: '#475569', fontSize: '16px', margin: 0 }}>
                  Sri Bharathi English Medium School in Nagasamudram provides foundational learning from Nursery through 6th Class. We aim to combine clear classroom expectations with patient guidance, so children can build knowledge and confidence as they grow.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginBottom: '34px' }}>
                {[
                  { title: 'Our purpose', icon: '🎯', text: 'Help students develop strong foundations in learning, communication and responsible behaviour.' },
                  { title: 'How we teach', icon: '🧩', text: 'Use explanation, practice, classroom activities and encouragement to make concepts easier to understand.' },
                  { title: 'What we value', icon: '🤝', text: 'Respect, discipline, curiosity, kindness and a positive partnership between school and family.' }
                ].map((item, index) => (
                  <article key={index} style={{ background: '#fff', padding: '22px', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                    <span style={{ fontSize: '28px' }}>{item.icon}</span>
                    <h3 style={{ color: '#0f172a', margin: '10px 0 6px', fontSize: '18px' }}>{item.title}</h3>
                    <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>{item.text}</p>
                  </article>
                ))}
              </div>

              <div style={{ background: '#f8fafc', padding: '26px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                <h3 style={{ color: '#0f172a', margin: '0 0 12px' }}>A foundation that grows with your child</h3>
                <p style={{ color: '#475569', margin: '0 0 12px' }}>
                  Early learning focuses on becoming comfortable with classroom routines and exploring language, numbers and creative activities. As students move through the primary classes, they continue to practise reading, writing, mathematics and subject knowledge while learning to ask questions and share their ideas.
                </p>
                <p style={{ color: '#475569', margin: 0 }}>
                  English is the medium of instruction. Telugu, English, Mathematics, Science / EVS and Social / GK are included in the school's student progress reports.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', alignItems: 'stretch' }}>
                <div style={{ background: '#eff6ff', padding: '24px', borderRadius: '10px' }}>
                  <h3 style={{ color: '#0f172a', margin: '0 0 10px' }}>Learning beyond the textbook</h3>
                  <p style={{ color: '#475569', margin: 0 }}>
                    Drawing, puzzles, educational play, games and physical activities give children opportunities to practise creativity, teamwork and communication alongside classroom learning.
                  </p>
                </div>
                <div style={{ background: '#f0fdf4', padding: '24px', borderRadius: '10px' }}>
                  <h3 style={{ color: '#0f172a', margin: '0 0 10px' }}>Working together with families</h3>
                  <p style={{ color: '#475569', margin: 0 }}>
                    Parents and guardians can contact the school with questions about class placement, admission availability, required documents and current fee details. Please confirm these directly with the school before applying.
                  </p>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: '28px' }}>
                <button onClick={() => setWebPage('admission-form')} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Make an admission enquiry 📝
                </button>
              </div>
            </section>
          )}

          {/* FACILITIES */}
          {webPage === 'facilities' && (
            <section style={{ maxWidth: '1100px', margin: '50px auto', padding: '0 24px' }}>
              <div style={{ textAlign: 'center', maxWidth: '760px', margin: '0 auto 36px' }}>
                <h2 style={{ fontSize: '32px', color: '#0f172a', margin: '0 0 10px' }}>Campus & Facilities</h2>
                <p style={{ color: '#64748b', lineHeight: '1.7', margin: 0 }}>
                  A welcoming learning environment includes spaces for classroom study, creative activities, communication practice and students' everyday needs.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                {[
                  { name: 'Spacious Classrooms', desc: 'Well-ventilated classrooms with child-friendly seating arrangements.', tag: 'Infrastructure' },
                  { name: 'English Speaking Environment', desc: 'Daily activities designed to build fluency and conversation skills in English.', tag: 'Academics' },
                  { name: 'Junior Activity Room', desc: 'Educational toys, drawing kits and puzzles for children.', tag: 'Play & Learn' },
                  { name: 'Safe Drinking Water (RO)', desc: 'Clean, hygienic reverse osmosis drinking water stations.', tag: 'Health & Safety' }
                ].map((item, i) => (
                  <div key={i} style={{ background: '#fff', padding: '24px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '11px', background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{item.tag}</span>
                    <h3 style={{ margin: '12px 0 6px 0', fontSize: '18px' }}>{item.name}</h3>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>{item.desc}</p>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '28px', padding: '22px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #dbeafe' }}>
                <h3 style={{ margin: '0 0 8px', color: '#0f172a' }}>Questions to ask during a campus visit</h3>
                <p style={{ color: '#475569', margin: 0, lineHeight: '1.7' }}>
                  Ask about class routines, learning materials, activity schedules, drinking-water arrangements and how the school communicates student progress. Please confirm which facilities and services are currently available directly with the school.
                </p>
              </div>
            </section>
          )}

          {/* ADMISSION FORM */}
          {webPage === 'admission-form' && (
            <section style={{ maxWidth: '600px', margin: '50px auto', padding: '32px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '22px', margin: '0 0 4px 0', color: '#0f172a' }}>SRI BHARATHI EM SCHOOL, NAGASAMUDRAM</h2>
              <p style={{ color: '#2563eb', fontWeight: 'bold', fontSize: '14px', margin: '0 0 16px 0' }}>Online Admission Enquiry (2026-27)</p>
              <div style={{ background: '#eff6ff', padding: '14px', borderRadius: '6px', marginBottom: '18px', color: '#1e3a8a', fontSize: '14px', lineHeight: '1.6' }}>
                <b>Before you enquire:</b> Choose the class you are interested in and provide a contact number. Please contact the school to confirm seat availability, fee details, timings and required documents.
              </div>

              {enquirySuccess ? (
                <div style={{ padding: '16px', background: '#dcfce7', color: '#15803d', borderRadius: '6px', fontWeight: 'bold', textAlign: 'center' }}>
                  ✅ Thank you for your interest. This demo form does not send enquiries to the school yet. Please contact the school directly to confirm admission details.
                  <button type="button" onClick={() => setWebPage('contact')} style={{ display: 'block', margin: '14px auto 0', background: '#2563eb', color: '#fff', border: 'none', padding: '9px 14px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                    View school contact details
                  </button>
                </div>
              ) : (
                <form onSubmit={handleEnquirySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>This demo form is for preview only and does not send personal details to the school. Please use the Contact page for a real enquiry.</p>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Student Full Name:</label>
                    <input style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} required value={enquiryForm.studentName} onChange={e => setEnquiryForm({...enquiryForm, studentName: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Seeking Admission For Grade:</label>
                    <select style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} value={enquiryForm.grade} onChange={e => setEnquiryForm({...enquiryForm, grade: e.target.value})}>
                      {classList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Parent / Guardian Name:</label>
                    <input style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} required value={enquiryForm.parentName} onChange={e => setEnquiryForm({...enquiryForm, parentName: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>WhatsApp Mobile Number:</label>
                    <input style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} required type="tel" value={enquiryForm.phone} onChange={e => setEnquiryForm({...enquiryForm, phone: e.target.value})} />
                  </div>
                  <div>
                    <label style={{ fontSize: '13px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Question or preferred visit details (optional):</label>
                    <textarea rows="3" placeholder="For example: questions about class availability or arranging a campus visit" style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', resize: 'vertical' }} value={enquiryForm.message} onChange={e => setEnquiryForm({...enquiryForm, message: e.target.value})} />
                  </div>
                  <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Submit Admission Enquiry 📩
                  </button>
                </form>
              )}
            </section>
          )}

          {/* CONTACT */}
          {webPage === 'contact' && (
            <section style={{ maxWidth: '800px', margin: '50px auto', padding: '0 24px' }}>
              <h2>Contact Information</h2>
              <div style={{ background: '#fff', padding: '32px', borderRadius: '12px', border: '1px solid #e2e8f0', lineHeight: '2' }}>
                <p>📍 <b>Campus Address:</b> Main Road, Nagasamudram, Andhra Pradesh, India</p>
                <p>📞 <b>School Contact:</b> +91 98765 43210</p>
                <p>💬 <b>WhatsApp Support:</b> +91 98765 43210</p>
                <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '18px 0' }} />
                <h3 style={{ lineHeight: 1.4, margin: '0 0 8px' }}>How the school can help</h3>
                <p style={{ margin: 0, lineHeight: 1.7, color: '#475569' }}>
                  Contact the school to ask about admissions, class availability, fee details, school timings, campus visits or student progress. For a faster response, include the student's name and class of interest in your enquiry.
                </p>
              </div>
            </section>
          )}

          <footer style={{ background: '#0f172a', color: '#94a3b8', padding: '30px 24px', textAlign: 'center', marginTop: '80px', fontSize: '14px' }}>
            © 2026 <b>SRI BHARATHI EM SCHOOL, NAGASAMUDRAM</b>. All rights reserved.
          </footer>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ADMIN & TEACHER ERP PORTAL SECTION */}
      {/* ========================================================================= */}
      {currentView === 'portal' && isAuthenticated && (
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 75px)' }}>
          
          <aside style={{ width: '250px', background: '#1e293b', color: '#fff', padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ padding: '0 10px 12px 10px', borderBottom: '1px solid #334155', marginBottom: '6px' }}>
              <b style={{ color: '#facc15', fontSize: '13px' }}>SRI BHARATHI ERP</b><br />
              <small style={{ color: '#94a3b8' }}>Nagasamudram Portal</small>
            </div>
            {[
              { id: 'dashboard', label: 'Overview', icon: '📊' },
              { id: 'students', label: 'Student Directory', icon: '👥' },
              { id: 'attendance', label: 'Daily Attendance', icon: '📅' },
              { id: 'fees', label: 'Pending Fees & WhatsApp', icon: '💰' },
              { id: 'reports', label: 'Progress Reports', icon: '📄' },
              { id: 'notices', label: 'Manage Notices', icon: '📢' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setPortalTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  background: portalTab === tab.id ? '#2563eb' : 'transparent',
                  color: portalTab === tab.id ? '#fff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: portalTab === tab.id ? '700' : '500',
                  textAlign: 'left'
                }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </aside>

          <main style={{ flex: 1, padding: '28px', overflowY: 'auto' }}>
            
            {/* OVERVIEW CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              {[
                { title: 'Total Enrolled', value: students.length, color: '#2563eb', icon: '🎓' },
                { title: 'Fee Defaulters', value: pendingStudents.length, color: '#dc2626', icon: '⚠️' },
                { title: 'Outstanding Balance', value: `₹${totalOutstanding.toLocaleString('en-IN')}`, color: '#d97706', icon: '💳' },
                { title: 'Fees Collected', value: `₹${totalFeesCollected.toLocaleString('en-IN')}`, color: '#059669', icon: '✅' },
                { title: 'Active Notices', value: notices.length, color: '#7c3aed', icon: '📢' }
              ].map((card, idx) => (
                <div key={idx} style={{ background: '#fff', padding: '18px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{card.title}</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: card.color, marginTop: '4px' }}>{card.value}</div>
                  </div>
                  <span style={{ fontSize: '24px' }}>{card.icon}</span>
                </div>
              ))}
            </div>

            {/* TAB: DASHBOARD */}
            {portalTab === 'dashboard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ background: '#fff', padding: '28px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <p style={{ color: '#2563eb', fontWeight: 'bold', margin: '0 0 6px' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <h2 style={{ margin: '0 0 8px' }}>Welcome to SRI BHARATHI EM SCHOOL Management Portal</h2>
                  <p style={{ color: '#64748b', margin: 0, lineHeight: '1.7' }}>Use this overview to check current student and fee totals, prepare a class attendance list, review notices, and open the tools available for your account.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px' }}>
                  <section style={{ background: '#fff', padding: '22px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 6px' }}>Attendance preparation</h3>
                    <p style={{ color: '#64748b', margin: '0 0 14px' }}>Current marks for {attendanceClass} · {attendanceDate}. These are not saved until attendance is submitted.</p>
                    {attendanceClassStudents.length ? (
                      <p style={{ margin: '0 0 14px', fontWeight: 'bold' }}>
                        👥 {attendanceClassStudents.length} students &nbsp; · &nbsp;
                        <span style={{ color: '#15803d' }}>{presentCount} present</span> &nbsp; · &nbsp;
                        <span style={{ color: '#b91c1c' }}>{absentCount} absent</span>
                      </p>
                    ) : (
                      <p style={{ color: '#64748b', margin: '0 0 14px' }}>No enrolled students found for this class yet.</p>
                    )}
                    <button onClick={() => setPortalTab('attendance')} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '9px 14px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Open attendance</button>
                  </section>
                  <section style={{ background: '#fff', padding: '22px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ margin: '0 0 6px' }}>Fee follow-up</h3>
                    <p style={{ color: '#64748b', margin: '0 0 14px' }}>
                      {pendingStudents.length
                        ? `${pendingStudents.length} student${pendingStudents.length === 1 ? '' : 's'} have a pending balance of ₹${totalOutstanding.toLocaleString('en-IN')}.`
                        : 'No pending fee balances are currently listed.'}
                    </p>
                    <p style={{ margin: '0 0 14px', fontWeight: 'bold' }}>Collected to date: ₹{totalFeesCollected.toLocaleString('en-IN')}</p>
                    <button onClick={() => setPortalTab('fees')} style={{ background: '#059669', color: '#fff', border: 'none', padding: '9px 14px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Review pending fees</button>
                  </section>
                </div>
                <div style={{ background: '#fff', padding: '22px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 12px' }}>Latest school notices</h3>
                  {notices.length ? notices.slice(0, 3).map(notice => (
                    <div key={notice.id} style={{ padding: '10px 0', borderTop: '1px solid #e2e8f0' }}>
                      <b>{notice.title}</b>
                      <p style={{ color: '#64748b', margin: '4px 0 0' }}>{notice.desc}</p>
                    </div>
                  )) : <p style={{ color: '#64748b', margin: 0 }}>No notices have been published yet.</p>}
                  <button onClick={() => setPortalTab('notices')} style={{ background: '#334155', color: '#fff', border: 'none', padding: '9px 14px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', marginTop: '12px' }}>View notice board</button>
                </div>
                {userRole === 'admin' && (
                  <div style={{ marginTop: '20px', padding: '16px', background: '#eff6ff', borderRadius: '6px', borderLeft: '4px solid #2563eb' }}>
                    <b>Demo Student Data Setup:</b>
                    <br /><br />
                    <button onClick={() => axios.get('http://localhost:5000/api/seed').then(loadData)} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                      + Load Demo Student Data
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB: STUDENTS DIRECTORY & EXCEL BULK UPLOAD */}
            {portalTab === 'students' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {userRole === 'admin' ? (
                  <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    
                    {/* Header with Excel Bulk Upload Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                      <h3 style={{ margin: 0 }}>➕ Add New Student Admission (Admin)</h3>
                      
                      <label style={{ background: '#10b981', color: '#fff', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        📊 Bulk Upload Excel (.xlsx)
                        <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} style={{ display: 'none' }} />
                      </label>
                    </div>

                    <form onSubmit={handleAddStudent} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                      <input placeholder="Roll No (e.g. 109)" value={newStudent.rollNo} onChange={e => setNewStudent({...newStudent, rollNo: e.target.value})} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} required />
                      <input placeholder="Student Full Name" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} required />
                      <select value={newStudent.standard} onChange={e => setNewStudent({...newStudent, standard: e.target.value})} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                        {classList.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input placeholder="Parent Name" value={newStudent.parentName} onChange={e => setNewStudent({...newStudent, parentName: e.target.value})} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} required />
                      <input placeholder="Parent Phone" value={newStudent.parentPhone} onChange={e => setNewStudent({...newStudent, parentPhone: e.target.value})} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} required />
                      <input placeholder="Total Fee (₹)" type="number" value={newStudent.totalFee} onChange={e => setNewStudent({...newStudent, totalFee: e.target.value})} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} required />
                      <input placeholder="Paid Fee (₹)" type="number" value={newStudent.paidFee} onChange={e => setNewStudent({...newStudent, paidFee: e.target.value})} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                      <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Save Student</button>
                    </form>
                  </div>
                ) : (
                  <div style={{ background: '#fef3c7', padding: '12px', borderRadius: '6px', color: '#92400e', fontWeight: '600' }}>
                    ℹ️ Viewing in Teacher Mode: Admissions and Records Editing are restricted to Administrator.
                  </div>
                )}

                <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ margin: '0 0 6px 0' }}>Enrolled Students List (Nursery - 6th)</h3>
                  <p style={{ color: '#64748b', margin: '0 0 16px' }}>Use the directory to verify class placement and parent contact details. Fee values are shown in rupees.</p>
                  <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', borderColor: '#e2e8f0', textAlign: 'center' }}>
                    <thead style={{ background: '#f8fafc' }}>
                      <tr>
                        <th>Roll No</th><th>Name</th><th>Class</th><th>Parent Phone</th><th>Total Fee</th><th>Paid Fee</th><th>Balance</th>
                        {userRole === 'admin' && <th>Admin Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {students.length ? students.map(s => (
                        <tr key={s._id}>
                          <td>{s.rollNo}</td>
                          <td style={{ fontWeight: 'bold' }}>{s.name}</td>
                          <td>{s.standard}</td>
                          <td>{s.parentPhone}</td>
                          <td>₹{s.totalFee}</td>
                          <td style={{ color: '#059669', fontWeight: 'bold' }}>₹{s.paidFee}</td>
                          <td style={{ color: Number(s.totalFee) > Number(s.paidFee) ? '#b91c1c' : '#15803d', fontWeight: 'bold' }}>₹{Math.max(0, (Number(s.totalFee) || 0) - (Number(s.paidFee) || 0))}</td>
                          {userRole === 'admin' && (
                            <td>
                              <button onClick={() => setEditingStudent(s)} style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', marginRight: '6px' }}>Edit ✏️</button>
                              <button onClick={() => handleDeleteStudent(s._id)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}>Delete 🗑️</button>
                            </td>
                          )}
                        </tr>
                      )) : (
                        <tr><td colSpan={userRole === 'admin' ? 8 : 7}>No student records found. Add a student or import a spreadsheet to get started.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Edit Modal */}
                {userRole === 'admin' && editingStudent && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', width: '400px' }}>
                      <h3>Edit Student Details</h3>
                      <form onSubmit={handleUpdateStudent} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input value={editingStudent.name} onChange={e => setEditingStudent({...editingStudent, name: e.target.value})} style={{ padding: '8px' }} required />
                        <select value={editingStudent.standard} onChange={e => setEditingStudent({...editingStudent, standard: e.target.value})} style={{ padding: '8px' }}>
                          {classList.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input value={editingStudent.parentPhone} onChange={e => setEditingStudent({...editingStudent, parentPhone: e.target.value})} style={{ padding: '8px' }} required />
                        <input type="number" value={editingStudent.totalFee} onChange={e => setEditingStudent({...editingStudent, totalFee: Number(e.target.value)})} style={{ padding: '8px' }} required />
                        <input type="number" value={editingStudent.paidFee} onChange={e => setEditingStudent({...editingStudent, paidFee: Number(e.target.value)})} style={{ padding: '8px' }} required />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                          <button type="button" onClick={() => setEditingStudent(null)} style={{ background: '#94a3b8', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px' }}>Cancel</button>
                          <button type="submit" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '4px', fontWeight: 'bold' }}>Save Changes</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB: ATTENDANCE & WHATSAPP ABSENT ALERTS */}
            {portalTab === 'attendance' && (
              <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                  <h3 style={{ margin: 0 }}>📅 Daily Attendance & Absent Parent Alerts</h3>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input 
                      type="date" 
                      value={attendanceDate} 
                      onChange={e => setAttendanceDate(e.target.value)} 
                      style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} 
                    />
                    <select 
                      value={attendanceClass} 
                      onChange={e => setAttendanceClass(e.target.value)} 
                      style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                    >
                      {classList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button 
                      onClick={saveAttendance} 
                      style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '9px 18px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Save Attendance 💾
                    </button>
                  </div>
                </div>
                <p style={{ color: '#64748b', margin: '0 0 16px', lineHeight: '1.6' }}>
                  Select the school date and class, mark each student's status, then save. WhatsApp alerts open a pre-filled message for you to review and send; they are not sent automatically.
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  <span style={{ background: '#dcfce7', color: '#15803d', padding: '7px 12px', borderRadius: '20px', fontWeight: 'bold' }}>Present: {presentCount}</span>
                  <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '7px 12px', borderRadius: '20px', fontWeight: 'bold' }}>Absent: {absentCount}</span>
                  <span style={{ background: '#f1f5f9', color: '#475569', padding: '7px 12px', borderRadius: '20px', fontWeight: 'bold' }}>Class total: {attendanceClassStudents.length}</span>
                </div>

                {attendanceStatusMsg && (
                  <div style={{ marginBottom: '14px', color: '#15803d', fontWeight: 'bold', background: '#dcfce7', padding: '10px', borderRadius: '4px' }}>
                    {attendanceStatusMsg}
                  </div>
                )}

                <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', borderColor: '#e2e8f0', textAlign: 'center' }}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr>
                      <th>Roll No</th>
                      <th>Student Name</th>
                      <th>Class</th>
                      <th>Parent Phone</th>
                      <th>Status</th>
                      <th>Attendance Toggle</th>
                      <th>Parent Notification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceClassStudents.length ? attendanceClassStudents.map(s => {
                      const isPresent = (attendanceRecords[s._id] || 'Present') === 'Present';
                      return (
                        <tr key={s._id} style={{ background: !isPresent ? '#fef2f2' : '#ffffff' }}>
                          <td>{s.rollNo}</td>
                          <td style={{ fontWeight: 'bold' }}>{s.name}</td>
                          <td>{s.standard}</td>
                          <td>{s.parentPhone}</td>
                          <td>
                            <span style={{ 
                              background: isPresent ? '#dcfce7' : '#fee2e2', 
                              color: isPresent ? '#15803d' : '#b91c1c', 
                              padding: '4px 12px', 
                              borderRadius: '12px', 
                              fontWeight: 'bold',
                              fontSize: '13px'
                            }}>
                              {isPresent ? 'Present' : 'Absent'}
                            </span>
                          </td>
                          <td>
                            <button 
                              onClick={() => setAttendanceRecords(prev => ({ ...prev, [s._id]: isPresent ? 'Absent' : 'Present' }))} 
                              style={{ 
                                background: isPresent ? '#ef4444' : '#22c55e', 
                                color: '#fff', 
                                border: 'none', 
                                padding: '6px 14px', 
                                borderRadius: '4px', 
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              Mark {isPresent ? 'Absent' : 'Present'}
                            </button>
                          </td>
                          <td>
                            {!isPresent ? (
                              <button 
                                onClick={() => sendAbsentAlert(s)}
                                style={{ 
                                  background: '#25d366', 
                                  color: '#fff', 
                                  border: 'none', 
                                  padding: '6px 14px', 
                                  borderRadius: '4px', 
                                  cursor: 'pointer', 
                                  fontWeight: 'bold',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                📲 Send Alert
                              </button>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '13px' }}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr><td colSpan="7">No enrolled students found for {attendanceClass}. Add a student record before taking attendance.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB: FEES & WHATSAPP */}
            {portalTab === 'fees' && (
              <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3>Outstanding Fee Defaulters & WhatsApp Reminders</h3>
                <p style={{ color: '#64748b', lineHeight: '1.6' }}>
                  Pending balance is calculated as total fee minus paid fee. Review each amount before contacting a parent; WhatsApp opens a draft message and requires staff to send it.
                </p>
                <table border="1" cellPadding="12" style={{ width: '100%', borderCollapse: 'collapse', borderColor: '#e2e8f0', textAlign: 'center', marginTop: '16px' }}>
                  <thead style={{ background: '#f8fafc' }}>
                    <tr><th>Roll No</th><th>Name</th><th>Class</th><th>Total Fee</th><th>Paid</th><th>Due Amount</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {pendingStudents.length ? pendingStudents.map(s => (
                      <tr key={s._id}>
                        <td>{s.rollNo}</td>
                        <td style={{ fontWeight: 'bold' }}>{s.name}</td>
                        <td>{s.standard}</td>
                        <td>₹{s.totalFee}</td>
                        <td>₹{s.paidFee}</td>
                        <td style={{ color: '#dc2626', fontWeight: 'bold' }}>₹{s.totalFee - s.paidFee}</td>
                        <td>
                          <button onClick={() => sendWhatsApp(s)} style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                            Send WhatsApp 📲
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan="7">No pending fee balances. Students with outstanding fees will appear here.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB: PROGRESS REPORTS */}
            {portalTab === 'reports' && (
              <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3>Generate 1-Click Printable PDF Report Card</h3>
                <p style={{ color: '#64748b', lineHeight: '1.6' }}>
                  Select a student to preview the currently recorded subject marks. Check the marks and student details before downloading the printable report.
                </p>
                <div style={{ margin: '16px 0' }}>
                  <label style={{ fontWeight: 'bold', marginRight: '10px' }}>Select Student:</label>
                  <select onChange={e => setSelectedStudent(students.find(s => s._id === e.target.value))} style={{ padding: '8px', borderRadius: '4px' }}>
                    <option value="">-- Select Student --</option>
                    {students.map(s => <option key={s._id} value={s._id}>{s.name} ({s.rollNo}) - {s.standard}</option>)}
                  </select>
                </div>

                {selectedStudent && (
                  <div>
                    <div ref={reportRef} className="print-report" style={{ width: '480px', border: '2px solid #0f172a', padding: '24px', background: '#fff', margin: '20px 0' }}>
                      <h2 style={{ textAlign: 'center', margin: '0 0 4px 0', color: '#0f172a' }}>SRI BHARATHI E.M. SCHOOL</h2>
                      <p style={{ textAlign: 'center', margin: 0, color: '#64748b', fontSize: '13px', fontWeight: 'bold' }}>NAGASAMUDRAM | PROGRESS REPORT (2026 - 2027)</p>
                      <hr style={{ margin: '14px 0' }} />
                      <p><b>Student Name:</b> {selectedStudent.name} | <b>Roll No:</b> {selectedStudent.rollNo}</p>
                      <p><b>Class:</b> {selectedStudent.standard}</p>

                      <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', margin: '14px 0', borderColor: '#334155' }}>
                        <thead style={{ background: '#f8fafc' }}>
                          <tr><th>Subject</th><th>Max Marks</th><th>Obtained</th></tr>
                        </thead>
                        <tbody>
                          <tr><td>Telugu</td><td>100</td><td>{selectedStudent.marks?.telugu || 0}</td></tr>
                          <tr><td>English</td><td>100</td><td>{selectedStudent.marks?.english || 0}</td></tr>
                          <tr><td>Mathematics</td><td>100</td><td>{selectedStudent.marks?.maths || 0}</td></tr>
                          <tr><td>Science / EVS</td><td>100</td><td>{selectedStudent.marks?.science || 0}</td></tr>
                          <tr><td>Social / GK</td><td>100</td><td>{selectedStudent.marks?.social || 0}</td></tr>
                          <tr style={{ fontWeight: 'bold' }}><td>Total / Average</td><td>500</td><td>{reportTotal} / 500 ({reportAverage}%)</td></tr>
                        </tbody>
                      </table>
                      <p style={{ color: '#475569', fontSize: '13px', margin: '10px 0' }}>Average is calculated across five subjects. Confirm marks with the class teacher before sharing this report.</p>
                      <p style={{ textAlign: 'right', marginTop: '24px', fontWeight: 'bold' }}>Principal Signature: ____________</p>
                    </div>

                    <button onClick={downloadPDF} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                      Download Printable PDF 🖨️
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB: NOTICES */}
            {portalTab === 'notices' && (
              <div style={{ background: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3>Post Official Notice to Website</h3>
                <form onSubmit={handleAddNotice} style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '600px', margin: '16px 0 24px 0' }}>
                  <input placeholder="Notice Title (e.g. Science Fair 2026)" value={newNotice.title} onChange={e => setNewNotice({...newNotice, title: e.target.value})} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} required />
                  <textarea placeholder="Notice Description" rows="3" value={newNotice.desc} onChange={e => setNewNotice({...newNotice, desc: e.target.value})} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} required></textarea>
                  <button type="submit" style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Publish Notice 📢</button>
                </form>
                <p style={{ color: '#64748b', fontSize: '13px' }}>Published notices appear on the public website. The publish date is set to today's date automatically.</p>

                <h4>Current Published Notices:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {notices.length ? notices.map(n => (
                    <div key={n.id} style={{ background: '#f8fafc', padding: '14px', borderRadius: '6px', borderLeft: '4px solid #2563eb' }}>
                      <b>{n.title}</b> <small style={{ color: '#64748b' }}>({n.date})</small>
                      <p style={{ margin: '4px 0 0 0', color: '#475569' }}>{n.desc}</p>
                    </div>
                  )) : <p style={{ color: '#64748b' }}>No notices have been published. Add a title and details above to share an update.</p>}
                </div>
              </div>
            )}

          </main>
        </div>
      )}

    </div>
  );
}