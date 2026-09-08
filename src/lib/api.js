/**
 * Centralized API service for NBTC Microwave Pre-PM Survey Control Room
 */

export async function fetchDashboardData() {
  const res = await fetch('/api/dashboard', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Failed to load dashboard metrics (status ${res.status})`);
  }
  return res.json();
}

export async function fetchStations(token) {
  let res = await fetch('/api/database', {
    headers: { Authorization: `Bearer ${token}` }
  }).catch(() => null);

  if (!res || res.status === 404) {
    res = await fetch('/database', {
      headers: { Authorization: `Bearer ${token}` }
    });
  }

  if (!res.ok) {
    throw new Error(`Failed to load station directory (status ${res.status})`);
  }
  return res.json();
}

export async function loginUser(password) {
  let res;
  try {
    // Try modern /api/login endpoint first
    res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    // Fall back to /login if 404
    if (res.status === 404) {
      res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
    }
  } catch {
    // If /api/login failed at network level, try /login directly
    try {
      res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
    } catch {
      throw new Error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์ Backend ทำงานอยู่ (python database.py)');
    }
  }

  if (res.status === 503) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'เซิร์ฟเวอร์ Backend ยังไม่ได้เริ่มต้น (กรุณารัน python database.py)');
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || 'รหัสผ่านไม่ถูกต้อง');
  }
  return res.json();
}

export async function submitSurvey(token, fields, photos) {
  let res = await fetch('/api/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ fields, photos })
  }).catch(() => null);

  if (!res || res.status === 404) {
    res = await fetch('/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ fields, photos })
    });
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || 'บันทึกข้อมูลไม่สำเร็จ');
  }
  return res.json();
}
