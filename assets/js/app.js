/**
 * NBTC Microwave — Survey Control Room (Pre-PM)
 * Frontend Application (React 18 Component Tree)
 */

const { useState, useEffect, useMemo, useRef } = React;

// --------------------------------------------------------------------------
// 1. Core Visual Components
// --------------------------------------------------------------------------

/** Reusable SVG Icon */
function Icon({ name }) {
  return (
    <img
      src={`/assets/icons/${name}.svg`}
      alt=""
      aria-hidden="true"
    />
  );
}

/** Pointer-follow ambient spotlight effect */
function Spotlight() {
  useEffect(() => {
    const handleMove = (e) => {
      document.documentElement.style.setProperty('--mx', `${e.clientX}px`);
      document.documentElement.style.setProperty('--my', `${e.clientY}px`);
    };
    window.addEventListener('pointermove', handleMove);
    return () => window.removeEventListener('pointermove', handleMove);
  }, []);

  return <div className="spot" />;
}

/** Animated text gradient header */
function ShinyText({ children }) {
  return (
    <span
      style={{
        background: 'linear-gradient(110deg, #fff 35%, #68e4e0 50%, #fff 65%)',
        backgroundSize: '250% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        animation: 'shine 3s linear infinite'
      }}
    >
      {children}
    </span>
  );
}

/** Glassmorphism Card Container */
function GlassCard({ children, className = '' }) {
  return <article className={`glass ${className}`}>{children}</article>;
}

// --------------------------------------------------------------------------
// 2. Dashboard Component
// --------------------------------------------------------------------------

const initialStats = { surveys: 0, stations: 0, allowed: 0, denied: 0 };

function Dashboard() {
  const [data, setData] = useState({
    stats: initialStats,
    provinces: [],
    recent: [],
    updatedAt: new Date().toISOString()
  });
  const [isLoading, setIsLoading] = useState(false);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const maxProvinceCount = Math.max(...data.provinces.map((p) => p.count), 1);

  return (
    <main className="page reveal">
      <header className="hero">
        <div>
          <div className="eyebrow">FIELD SERVICE / LIVE OPERATIONS</div>
          <h1>
            <ShinyText>Survey Dashboard</ShinyText>
          </h1>
          <div className="sub">ศูนย์ควบคุมงานสำรวจและบันทึกการเข้าพื้นที่ (Pre-PM)</div>
        </div>
        <div className="live">
          <span className="dot" />
          LIVE DATA {isLoading && '· กำลังซิงค์...'}
          <br />
          {new Date(data.updatedAt).toLocaleString('th-TH')}
        </div>
      </header>

      {/* KPI Statistic Cards */}
      <section className="cards">
        <GlassCard className="card">
          <small>ผลสำรวจทั้งหมด</small>
          <span className="value blue">{data.stats.surveys.toLocaleString()}</span>
        </GlassCard>
        <GlassCard className="card">
          <small>สถานีในระบบ</small>
          <span className="value cyan">{data.stats.stations.toLocaleString()}</span>
        </GlassCard>
        <GlassCard className="card">
          <small>อนุญาตเข้าพื้นที่</small>
          <span className="value green">{data.stats.allowed.toLocaleString()}</span>
        </GlassCard>
        <GlassCard className="card">
          <small>ไม่อนุญาตเข้าพื้นที่</small>
          <span className="value pink">{data.stats.denied.toLocaleString()}</span>
        </GlassCard>
      </section>

      {/* Breakdown Grid */}
      <section className="grid">
        <GlassCard className="panel">
          <h2>พื้นที่ที่มีการสำรวจสูงสุด</h2>
          <div className="bars">
            {data.provinces.length > 0 ? (
              data.provinces.map((item) => (
                <div className="bar" key={item.name}>
                  <span>{item.name}</span>
                  <span className="track">
                    <span
                      className="fill"
                      style={{ width: `${(item.count / maxProvinceCount) * 100}%` }}
                    />
                  </span>
                  <strong>{item.count}</strong>
                </div>
              ))
            ) : (
              <div className="empty">ยังไม่มีข้อมูล</div>
            )}
          </div>
        </GlassCard>

        <GlassCard className="panel">
          <h2>รายการสำรวจล่าสุด</h2>
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>รหัสรายการ</th>
                  <th>สถานี</th>
                  <th>จังหวัด</th>
                  <th>ผล</th>
                  <th>เวลาบันทึก</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.length > 0 ? (
                  data.recent.map((item) => (
                    <tr key={item.recordId}>
                      <td>{item.recordId}</td>
                      <td>{item.station}</td>
                      <td>{item.province}</td>
                      <td>
                        <span
                          className={`badge ${
                            item.permit === 'อนุญาต'
                              ? 'ok'
                              : item.permit === 'ไม่อนุญาต'
                              ? 'no'
                              : ''
                          }`}
                        >
                          {item.permit}
                        </span>
                      </td>
                      <td>{new Date(item.savedAt).toLocaleString('th-TH')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="empty">
                      ยังไม่มีผลสำรวจ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </section>
    </main>
  );
}

// --------------------------------------------------------------------------
// 3. Field Visit Form Component
// --------------------------------------------------------------------------

function FieldVisit() {
  const [stations, setStations] = useState([]);
  const [formData, setFormData] = useState({});
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const token = useMemo(() => sessionStorage.getItem('surveyToken') || '', []);

  // Fetch stations for auto-completion
  useEffect(() => {
    fetch('/database', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setStations(
          (data.stations || []).map((s) => ({
            village: s.village,
            subdistrict: s.subdistrict,
            district: s.district,
            province: s.province,
            installationPlace: s.installation_place,
            equipmentPlace: s.equipment_place,
            contactName: s.contact_name,
            contactPosition: s.contact_position
          }))
        );
      })
      .catch(() => {});
  }, [token]);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-fill installation and contact details when station is selected
  const activeStation = useMemo(
    () => stations.find((s) => s.village === formData.station),
    [stations, formData.station]
  );

  useEffect(() => {
    if (activeStation) {
      setFormData((prev) => ({
        ...prev,
        installationPlace: activeStation.installationPlace || prev.installationPlace || '',
        equipmentPlace: activeStation.equipmentPlace || prev.equipmentPlace || '',
        contactName: activeStation.contactName || prev.contactName || '',
        contactPosition: activeStation.contactPosition || prev.contactPosition || ''
      }));
    }
  }, [activeStation]);

  // Handle photo selection & preview generation
  const handlePhotoSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedPhotos((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            type: file.type || 'image/jpeg',
            previewUrl: reader.result,
            base64Data: reader.result.split(',')[1]
          }
        ]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so the same files can be re-selected if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = (index) => {
    setSelectedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage({ text: 'กำลังส่งข้อมูลและอัปโหลดรูปภาพ...', type: 'info' });

    try {
      const photosPayload = selectedPhotos.map((p) => ({
        name: p.name,
        type: p.type,
        data: p.base64Data
      }));

      const res = await fetch('/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fields: formData,
          photos: photosPayload
        })
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.message || 'บันทึกข้อมูลไม่สำเร็จ');
      }

      const result = await res.json();
      setStatusMessage({
        text: `บันทึกข้อมูลรหัส ${result.recordId} เรียบร้อยแล้ว`,
        type: 'success'
      });

      // Clear form and photo previews
      setFormData({});
      setSelectedPhotos([]);
    } catch (err) {
      setStatusMessage({
        text: err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderInput = (id, label, type = 'text', extraProps = {}) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        className="input"
        id={id}
        type={type}
        value={formData[id] || ''}
        onChange={(e) => updateField(id, e.target.value)}
        {...extraProps}
      />
    </div>
  );

  const renderTextarea = (id, label) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        className="input"
        id={id}
        rows="2"
        value={formData[id] || ''}
        onChange={(e) => updateField(id, e.target.value)}
      />
    </div>
  );

  return (
    <main className="page reveal">
      <form className="formShell" onSubmit={handleSubmit}>
        <div className="eyebrow">FIELD VISIT / SITE RECORD</div>
        <h1 className="formTitle">แบบบันทึกเข้าตรวจเยี่ยมเจ้าของพื้นที่</h1>

        {/* 01 ข้อมูลสถานี */}
        <div className="section">
          <h2>01 · ข้อมูลสถานี</h2>
          <div className="field">
            <label htmlFor="station">ชื่อสถานี</label>
            <input
              className="input"
              id="station"
              list="stations-list"
              required
              placeholder="พิมพ์เพื่อค้นหาชื่อสถานี..."
              value={formData.station || ''}
              onChange={(e) => updateField('station', e.target.value)}
            />
            <datalist id="stations-list">
              {stations.map((s, idx) => (
                <option key={idx} value={s.village}>
                  {s.province ? `${s.village} (${s.district}, ${s.province})` : s.village}
                </option>
              ))}
            </datalist>
          </div>
          {renderInput('installationPlace', 'สถานที่ติดตั้ง')}
          {renderInput('equipmentPlace', 'สถานที่วางเครื่อง')}
          {renderInput('visitDate', 'วันที่เข้าพื้นที่', 'date')}
          {renderInput('visitTime', 'เวลาเข้าพื้นที่', 'time')}
        </div>

        {/* 02 ผู้ให้ข้อมูลในพื้นที่ */}
        <div className="section">
          <h2>02 · ผู้ให้ข้อมูลในพื้นที่</h2>
          {renderInput('contactName', 'ชื่อ - สกุล')}
          {renderInput('contactPosition', 'ตำแหน่ง')}
          {renderInput('contactVillage', 'หน่วยงาน / หมู่บ้าน')}
          {renderInput('contactPhone', 'เบอร์โทรศัพท์', 'tel')}
        </div>

        {/* 03 การขออนุญาตเข้าพื้นที่ */}
        <div className="section">
          <h2>03 · การขออนุญาตเข้าพื้นที่</h2>
          <div className="field">
            <label>ได้รับอนุญาตให้ดำเนินการหรือไม่</label>
            <div className="radio">
              <label>
                <input
                  type="radio"
                  name="permit"
                  value="อนุญาต"
                  checked={formData.permit === 'อนุญาต'}
                  onChange={(e) => updateField('permit', e.target.value)}
                />
                อนุญาต
              </label>
              <label>
                <input
                  type="radio"
                  name="permit"
                  value="ไม่อนุญาต"
                  checked={formData.permit === 'ไม่อนุญาต'}
                  onChange={(e) => updateField('permit', e.target.value)}
                />
                ไม่อนุญาต
              </label>
            </div>
          </div>
          {renderTextarea('accessLimit', 'ข้อจำกัดในการเข้าพื้นที่')}
        </div>

        {/* 04 สอบถามการใช้งาน */}
        <div className="section">
          <h2>04 · สอบถามการใช้งาน</h2>
          <table className="formtable">
            <thead>
              <tr>
                <th>หัวข้อ</th>
                <th style={{ width: '160px' }}>คำตอบ</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['radioStatus', 'สามารถใช้งานเครื่องวิทยุได้ตามปกติ', ['ปกติ', 'ไม่ปกติ']],
                ['receiveStatus', 'พบปัญหาการรับสัญญาณ', ['ไม่พบ', 'พบ']],
                ['transmitStatus', 'พบปัญหาการส่งสัญญาณ', ['ไม่พบ', 'พบ']],
                ['powerStatus', 'ระบบไฟฟ้ามีปัญหาหรือไม่', ['ไม่มี', 'มี']],
                ['batteryStatus', 'แบตเตอรี่สำรองมีปัญหาหรือไม่', ['ไม่มี', 'มี']]
              ].map(([key, label, options]) => (
                <tr key={key}>
                  <td>{label}</td>
                  <td>
                    <select
                      className="input"
                      value={formData[key] || options[0]}
                      onChange={(e) => updateField(key, e.target.value)}
                    >
                      {options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {renderTextarea('userProblem', 'ปัญหาเพิ่มเติมที่ผู้ใช้งานแจ้ง')}
        </div>

        {/* 05 สภาพแวดล้อมหน้างาน */}
        <div className="section">
          <h2>05 · สภาพแวดล้อมหน้างาน</h2>
          {renderTextarea('siteCondition', 'สภาพพื้นที่ติดตั้งอุปกรณ์')}
          {renderTextarea('antennaCondition', 'สภาพเสาอากาศและสายอากาศที่มองเห็นได้จากพื้น')}
          {renderTextarea('workObstacle', 'อุปสรรคในการปฏิบัติงาน')}
        </div>

        {/* 06 ภาพถ่ายก่อนดำเนินงาน */}
        <div className="section">
          <h2>06 · ภาพถ่ายก่อนดำเนินงาน</h2>
          <div className="field">
            <label htmlFor="photos-input">เลือกภาพถ่ายหน้างาน (สามารถเลือกหลายภาพได้)</label>
            <input
              ref={fileInputRef}
              className="input"
              id="photos-input"
              type="file"
              multiple
              accept="image/*"
              onChange={handlePhotoSelect}
            />
          </div>

          {/* Photo Preview Thumbnails */}
          {selectedPhotos.length > 0 && (
            <div className="photo-preview-grid">
              {selectedPhotos.map((photo, idx) => (
                <div className="photo-preview-item" key={idx}>
                  <img src={photo.previewUrl} alt={photo.name} />
                  <button
                    type="button"
                    className="photo-remove-btn"
                    title="ลบรูปนี้"
                    onClick={() => handleRemovePhoto(idx)}
                  >
                    ×
                  </button>
                  <div className="photo-info">{photo.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 07 ยืนยันข้อมูล */}
        <div className="section">
          <h2>07 · ยืนยันข้อมูล</h2>
          {renderTextarea('summary', 'สรุปสิ่งที่ได้รับแจ้งจากเจ้าของพื้นที่')}
          {renderInput('informantName', 'ชื่อผู้ให้ข้อมูล')}
          {renderInput('operatorName', 'ชื่อผู้ปฏิบัติงาน')}
        </div>

        {/* Submit & Status */}
        <button className="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <div className="spinner" />
              <span>กำลังบันทึกข้อมูล...</span>
            </>
          ) : (
            'บันทึกข้อมูล'
          )}
        </button>

        {statusMessage.text && (
          <div className={`status-alert ${statusMessage.type}`}>
            {statusMessage.text}
          </div>
        )}
      </form>
    </main>
  );
}

// --------------------------------------------------------------------------
// 4. Authentication Component
// --------------------------------------------------------------------------

function LoginView({ onLoginSuccess }) {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (!res.ok) throw new Error('รหัสผ่านไม่ถูกต้อง');

      const data = await res.json();
      sessionStorage.setItem('surveyToken', data.token);
      onLoginSuccess(data.token);
    } catch (err) {
      setErrorMsg(err.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login">
      <form className="loginbox glass reveal" onSubmit={handleLogin}>
        <div className="brand">
          <Icon name="dashboard" />
          <div>
            <small>SURVEY CONTROL ROOM</small>
            NBTC MICROWAVE
          </div>
        </div>
        <h1>เข้าสู่ระบบ</h1>
        <div className="hint">
          กรุณากรอกรหัสผ่านเพื่อเข้าใช้งาน Dashboard และแบบบันทึก Field Visit
        </div>

        <div className="field">
          <label htmlFor="login-password">รหัสผ่าน</label>
          <input
            className="input"
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
        </div>

        <button className="primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <div className="spinner" />
              <span>กำลังตรวจสอบ...</span>
            </>
          ) : (
            'เข้าสู่ระบบ'
          )}
        </button>

        {errorMsg && <div className="error">{errorMsg}</div>}
      </form>
    </div>
  );
}

// --------------------------------------------------------------------------
// 5. Main Application & Router
// --------------------------------------------------------------------------

function App() {
  const [currentPage, setCurrentPage] = useState(() =>
    location.pathname === '/dashboard' ? 'dashboard' : 'field'
  );
  const [token, setToken] = useState(() => sessionStorage.getItem('surveyToken') || '');

  const navigateTo = (page) => {
    setCurrentPage(page);
    history.pushState({}, '', page === 'dashboard' ? '/dashboard' : '/html');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('surveyToken');
    setToken('');
  };

  // Sync state with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(location.pathname === '/dashboard' ? 'dashboard' : 'field');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (!token) {
    return (
      <div className="app">
        <Spotlight />
        <LoginView onLoginSuccess={(newToken) => setToken(newToken)} />
      </div>
    );
  }

  return (
    <div className="app">
      <Spotlight />

      {/* Main Navigation Header */}
      <nav className="nav">
        <div className="navin">
          <div className="brand">
            <Icon name="dashboard" />
            <div>
              <small>SURVEY CONTROL ROOM</small>
              NBTC MICROWAVE
            </div>
          </div>

          <div className="navbtns">
            <button
              type="button"
              className={`navbtn ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => navigateTo('dashboard')}
            >
              <Icon name="dashboard" />
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              className={`navbtn ${currentPage === 'field' ? 'active' : ''}`}
              onClick={() => navigateTo('field')}
            >
              <Icon name="field-visit" />
              <span>Field Visit / Site Record</span>
            </button>

            <button
              type="button"
              className="navbtn logout"
              onClick={handleLogout}
            >
              <Icon name="logout" />
              <span>ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      {currentPage === 'dashboard' ? <Dashboard /> : <FieldVisit />}
    </div>
  );
}

// Mount the React Application
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
