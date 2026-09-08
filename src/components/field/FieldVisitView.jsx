import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Radio as RadioIcon,
  User,
  ShieldCheck,
  Zap,
  TreePine,
  Camera,
  CheckSquare,
  UploadCloud,
  Trash2,
  ZoomIn,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { GlassCard } from '@/components/ui/glass-card';
import { ShinyText } from '@/components/ui/shiny-text';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { fetchStations, submitSurvey } from '@/lib/api';

export function FieldVisitView() {
  const [stations, setStations] = useState([]);
  const [formData, setFormData] = useState({
    permit: 'อนุญาต',
    radioStatus: 'ปกติ',
    receiveStatus: 'ไม่พบ',
    transmitStatus: 'ไม่พบ',
    powerStatus: 'ไม่มี',
    batteryStatus: 'ไม่มี'
  });
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [statusMessage, setStatusMessage] = useState({ text: '', type: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activePreviewPhoto, setActivePreviewPhoto] = useState(null);
  const fileInputRef = useRef(null);

  const token = useMemo(() => sessionStorage.getItem('surveyToken') || '', []);

  // Fetch stations for auto-completion
  useEffect(() => {
    if (!token) return;
    fetchStations(token)
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
      .catch((err) => {
        console.error('Failed to fetch station directory:', err);
      });
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

  // Handle photo selection & base64 conversion
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

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = (index) => {
    setSelectedPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Form submission
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

      const result = await submitSurvey(token, formData, photosPayload);

      setStatusMessage({
        text: `บันทึกข้อมูลรหัส ${result.recordId} เรียบร้อยแล้ว`,
        type: 'success'
      });

      // Clear form and photo previews
      setFormData({
        permit: 'อนุญาต',
        radioStatus: 'ปกติ',
        receiveStatus: 'ไม่พบ',
        transmitStatus: 'ไม่พบ',
        powerStatus: 'ไม่มี',
        batteryStatus: 'ไม่มี'
      });
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

  return (
    <motion.main
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Form Header */}
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-950/60 via-slate-900/80 to-blue-950/60 p-6 shadow-2xl backdrop-blur-xl">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-400">
            FIELD VISIT / SITE RECORD
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-normal leading-normal text-white lg:text-3xl">
            <ShinyText>แบบบันทึกเข้าตรวจเยี่ยมเจ้าของพื้นที่</ShinyText>
          </h1>
          <p className="mt-1 text-sm text-slate-400 leading-relaxed">
            บันทึกการขออนุญาตเข้าพื้นที่ สภาพอุปกรณ์ภาคสนาม และภาพถ่ายประกอบการทำงาน
          </p>
        </div>

        {/* 01 ข้อมูลสถานี */}
        <GlassCard hoverEffect={false} className="space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-cyan-400">
              <RadioIcon className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-normal leading-normal">
              01 · ข้อมูลสถานี
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="station" className="block text-sm font-semibold text-slate-300 mb-1.5">
                ชื่อสถานี <span className="text-rose-400">*</span>
              </label>
              <input
                id="station"
                list="stations-list"
                required
                placeholder="พิมพ์เพื่อค้นหาชื่อสถานี..."
                value={formData.station || ''}
                onChange={(e) => updateField('station', e.target.value)}
                className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              <datalist id="stations-list">
                {stations.map((s, idx) => (
                  <option key={idx} value={s.village}>
                    {s.province ? `${s.village} (${s.district}, ${s.province})` : s.village}
                  </option>
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="installationPlace" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  สถานที่ติดตั้ง
                </label>
                <input
                  id="installationPlace"
                  type="text"
                  value={formData.installationPlace || ''}
                  onChange={(e) => updateField('installationPlace', e.target.value)}
                  className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label htmlFor="equipmentPlace" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  สถานที่วางเครื่อง
                </label>
                <input
                  id="equipmentPlace"
                  type="text"
                  value={formData.equipmentPlace || ''}
                  onChange={(e) => updateField('equipmentPlace', e.target.value)}
                  className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="visitDate" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  วันที่เข้าพื้นที่
                </label>
                <input
                  id="visitDate"
                  type="date"
                  value={formData.visitDate || ''}
                  onChange={(e) => updateField('visitDate', e.target.value)}
                  className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label htmlFor="visitTime" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  เวลาเข้าพื้นที่
                </label>
                <input
                  id="visitTime"
                  type="time"
                  value={formData.visitTime || ''}
                  onChange={(e) => updateField('visitTime', e.target.value)}
                  className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>
          </div>
        </GlassCard>

        {/* 02 ผู้ให้ข้อมูลในพื้นที่ */}
        <GlassCard hoverEffect={false} className="space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-cyan-400">
              <User className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-normal leading-normal">
              02 · ผู้ให้ข้อมูลในพื้นที่
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="contactName" className="block text-sm font-semibold text-slate-300 mb-1.5">
                ชื่อ - สกุล
              </label>
              <input
                id="contactName"
                type="text"
                value={formData.contactName || ''}
                onChange={(e) => updateField('contactName', e.target.value)}
                className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div>
              <label htmlFor="contactPosition" className="block text-sm font-semibold text-slate-300 mb-1.5">
                ตำแหน่ง
              </label>
              <input
                id="contactPosition"
                type="text"
                value={formData.contactPosition || ''}
                onChange={(e) => updateField('contactPosition', e.target.value)}
                className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div>
              <label htmlFor="contactVillage" className="block text-sm font-semibold text-slate-300 mb-1.5">
                หน่วยงาน / หมู่บ้าน
              </label>
              <input
                id="contactVillage"
                type="text"
                value={formData.contactVillage || ''}
                onChange={(e) => updateField('contactVillage', e.target.value)}
                className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div>
              <label htmlFor="contactPhone" className="block text-sm font-semibold text-slate-300 mb-1.5">
                เบอร์โทรศัพท์
              </label>
              <input
                id="contactPhone"
                type="tel"
                value={formData.contactPhone || ''}
                onChange={(e) => updateField('contactPhone', e.target.value)}
                className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>
        </GlassCard>

        {/* 03 การขออนุญาตเข้าพื้นที่ (Radix UI Radio Group) */}
        <GlassCard hoverEffect={false} className="space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-cyan-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-normal leading-normal">
              03 · การขออนุญาตเข้าพื้นที่
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                ได้รับอนุญาตให้ดำเนินการหรือไม่ <span className="text-rose-400">*</span>
              </label>
              <RadioGroup
                value={formData.permit || 'อนุญาต'}
                onValueChange={(val) => updateField('permit', val)}
                className="flex flex-wrap gap-4"
              >
                <label
                  htmlFor="permit-allow"
                  className="flex items-center gap-2.5 rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-5 py-3 text-sm font-medium text-slate-200 hover:border-emerald-500/40 cursor-pointer transition-colors"
                >
                  <RadioGroupItem value="อนุญาต" id="permit-allow" />
                  <span className="text-emerald-400 font-semibold">อนุญาต</span>
                </label>
                <label
                  htmlFor="permit-deny"
                  className="flex items-center gap-2.5 rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-5 py-3 text-sm font-medium text-slate-200 hover:border-rose-500/40 cursor-pointer transition-colors"
                >
                  <RadioGroupItem value="ไม่อนุญาต" id="permit-deny" />
                  <span className="text-rose-400 font-semibold">ไม่อนุญาต</span>
                </label>
              </RadioGroup>
            </div>

            <div>
              <label htmlFor="accessLimit" className="block text-sm font-semibold text-slate-300 mb-1.5">
                ข้อจำกัดในการเข้าพื้นที่
              </label>
              <textarea
                id="accessLimit"
                rows={2}
                value={formData.accessLimit || ''}
                onChange={(e) => updateField('accessLimit', e.target.value)}
                placeholder="ระบุข้อจำกัดหรือเงื่อนไขเพิ่มเติม (ถ้ามี)..."
                className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
              />
            </div>
          </div>
        </GlassCard>

        {/* 04 สอบถามการใช้งาน (Radix UI Select) */}
        <GlassCard hoverEffect={false} className="space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-cyan-400">
              <Zap className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-normal leading-normal">
              04 · สอบถามการใช้งาน
            </h2>
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-semibold text-slate-400">
                    <th className="px-4 py-3">หัวข้อการประเมิน</th>
                    <th className="px-4 py-3 w-48">ผลการตรวจสอบ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {[
                    ['radioStatus', 'สามารถใช้งานเครื่องวิทยุได้ตามปกติ', ['ปกติ', 'ไม่ปกติ']],
                    ['receiveStatus', 'พบปัญหาการรับสัญญาณ', ['ไม่พบ', 'พบ']],
                    ['transmitStatus', 'พบปัญหาการส่งสัญญาณ', ['ไม่พบ', 'พบ']],
                    ['powerStatus', 'ระบบไฟฟ้ามีปัญหาหรือไม่', ['ไม่มี', 'มี']],
                    ['batteryStatus', 'แบตเตอรี่สำรองมีปัญหาหรือไม่', ['ไม่มี', 'มี']]
                  ].map(([key, label, options]) => (
                    <tr key={key} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-medium text-slate-200 leading-normal">{label}</td>
                      <td className="px-4 py-2.5">
                        <Select
                          value={formData[key] || options[0]}
                          onValueChange={(val) => updateField(key, val)}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="เลือกคำตอบ" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <label htmlFor="userProblem" className="block text-sm font-semibold text-slate-300 mb-1.5">
                ปัญหาเพิ่มเติมที่ผู้ใช้งานแจ้ง
              </label>
              <textarea
                id="userProblem"
                rows={2}
                value={formData.userProblem || ''}
                onChange={(e) => updateField('userProblem', e.target.value)}
                className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
              />
            </div>
          </div>
        </GlassCard>

        {/* 05 สภาพแวดล้อมหน้างาน */}
        <GlassCard hoverEffect={false} className="space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-cyan-400">
              <TreePine className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-normal leading-normal">
              05 · สภาพแวดล้อมหน้างาน
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="siteCondition" className="block text-sm font-semibold text-slate-300 mb-1.5">
                สภาพพื้นที่ติดตั้งอุปกรณ์
              </label>
              <textarea
                id="siteCondition"
                rows={2}
                value={formData.siteCondition || ''}
                onChange={(e) => updateField('siteCondition', e.target.value)}
                className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
              />
            </div>

            <div>
              <label htmlFor="antennaCondition" className="block text-sm font-semibold text-slate-300 mb-1.5">
                สภาพเสาอากาศและสายอากาศที่มองเห็นได้จากพื้น
              </label>
              <textarea
                id="antennaCondition"
                rows={2}
                value={formData.antennaCondition || ''}
                onChange={(e) => updateField('antennaCondition', e.target.value)}
                className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
              />
            </div>

            <div>
              <label htmlFor="workObstacle" className="block text-sm font-semibold text-slate-300 mb-1.5">
                อุปสรรคในการปฏิบัติงาน
              </label>
              <textarea
                id="workObstacle"
                rows={2}
                value={formData.workObstacle || ''}
                onChange={(e) => updateField('workObstacle', e.target.value)}
                className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
              />
            </div>
          </div>
        </GlassCard>

        {/* 06 ภาพถ่ายก่อนดำเนินงาน */}
        <GlassCard hoverEffect={false} className="space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-cyan-400">
              <Camera className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-normal leading-normal">
              06 · ภาพถ่ายก่อนดำเนินงาน
            </h2>
          </div>

          <div className="space-y-4">
            {/* Upload Drag & Drop Area */}
            <label
              htmlFor="photos-input"
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-500/30 bg-blue-950/20 p-6 text-center hover:border-blue-500/60 hover:bg-blue-950/30 cursor-pointer transition-all duration-200"
            >
              <UploadCloud className="h-8 w-8 text-cyan-400 mb-2" />
              <div className="text-sm font-semibold text-slate-200">
                คลิกเพื่อเลือกภาพถ่ายหน้างาน (สามารถเลือกพร้อมกันได้หลายภาพ)
              </div>
              <div className="text-xs text-slate-400 mt-1">
                รองรับไฟล์ JPG, PNG, WebP
              </div>
              <input
                ref={fileInputRef}
                id="photos-input"
                type="file"
                multiple
                accept="image/*"
                onChange={handlePhotoSelect}
                className="sr-only"
              />
            </label>

            {/* Photo Thumbnails */}
            {selectedPhotos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
                {selectedPhotos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="group relative aspect-square rounded-xl overflow-hidden border border-blue-500/30 bg-slate-900 shadow-md"
                  >
                    <img
                      src={photo.previewUrl}
                      alt={photo.name}
                      className="h-full w-full object-cover"
                    />

                    {/* Overlay controls */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActivePreviewPhoto(photo)}
                        className="rounded-lg bg-blue-600/80 p-2 text-white hover:bg-blue-600 transition-colors"
                        title="ดูภาพขนาดใหญ่"
                      >
                        <ZoomIn className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="rounded-lg bg-rose-600/80 p-2 text-white hover:bg-rose-600 transition-colors"
                        title="ลบภาพนี้"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 text-[11px] text-slate-300 truncate">
                      {photo.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </GlassCard>

        {/* 07 ยืนยันข้อมูล */}
        <GlassCard hoverEffect={false} className="space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-800">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-cyan-400">
              <CheckSquare className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-white tracking-normal leading-normal">
              07 · ยืนยันข้อมูล
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="summary" className="block text-sm font-semibold text-slate-300 mb-1.5">
                สรุปสิ่งที่ได้รับแจ้งจากเจ้าของพื้นที่
              </label>
              <textarea
                id="summary"
                rows={3}
                value={formData.summary || ''}
                onChange={(e) => updateField('summary', e.target.value)}
                className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="informantName" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  ชื่อผู้ให้ข้อมูล
                </label>
                <input
                  id="informantName"
                  type="text"
                  value={formData.informantName || ''}
                  onChange={(e) => updateField('informantName', e.target.value)}
                  className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label htmlFor="operatorName" className="block text-sm font-semibold text-slate-300 mb-1.5">
                  ชื่อผู้ปฏิบัติงาน
                </label>
                <input
                  id="operatorName"
                  type="text"
                  value={formData.operatorName || ''}
                  onChange={(e) => updateField('operatorName', e.target.value)}
                  className="w-full rounded-xl border border-[rgba(115,149,174,0.25)] bg-[rgba(6,19,33,0.7)] px-4 py-2.5 text-base text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Submit Button with Framer Motion Spring */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 py-3.5 text-base font-bold tracking-normal leading-normal text-slate-950 shadow-lg shadow-blue-500/20 hover:shadow-cyan-500/30 transition-all disabled:opacity-60 cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>กำลังบันทึกข้อมูล...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5" />
              <span>บันทึกข้อมูลการเข้าตรวจเยี่ยม</span>
            </>
          )}
        </motion.button>

        {/* Status Feedback Message */}
        {statusMessage.text && (
          <div
            className={`flex items-center gap-2.5 rounded-xl border p-4 text-sm font-medium ${
              statusMessage.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                : statusMessage.type === 'error'
                ? 'border-rose-500/40 bg-rose-950/40 text-rose-300'
                : 'border-blue-500/40 bg-blue-950/40 text-blue-300'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-400" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-400" />
            ) : (
              <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-blue-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}
      </form>

      {/* Photo Preview Modal using Radix Dialog */}
      <Dialog
        open={Boolean(activePreviewPhoto)}
        onOpenChange={(open) => !open && setActivePreviewPhoto(null)}
      >
        <DialogContent className="max-w-2xl bg-slate-950/95 border-blue-500/40 p-4">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium text-slate-300 truncate">
              {activePreviewPhoto?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-xl bg-black/60 max-h-[70vh] flex items-center justify-center">
            {activePreviewPhoto && (
              <img
                src={activePreviewPhoto.previewUrl}
                alt={activePreviewPhoto.name}
                className="max-h-[65vh] w-auto object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.main>
  );
}
