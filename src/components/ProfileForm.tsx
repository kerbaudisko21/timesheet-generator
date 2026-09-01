"use client";

import { ChangeEvent, useRef } from "react";
import { Profile } from "@/lib/types";

type Props = {
  profile: Profile;
  onChange: (patch: Partial<Profile>) => void;
};

const TEXT_FIELDS: { key: keyof Profile; label: string; placeholder?: string }[] = [
  { key: "name", label: "Nama", placeholder: "Wilbert" },
  { key: "employeeId", label: "Employee ID", placeholder: "2601059148" },
  { key: "position", label: "Position", placeholder: "Solution Analyst" },
  { key: "placement", label: "Placement", placeholder: "PT Bank Mandiri" },
  { key: "location", label: "Location", placeholder: "Mandiri Digital Tower" },
  { key: "mainProjectName", label: "Main Project Name", placeholder: "Kopra" },
  { key: "projectCode", label: "Project Code" },
  { key: "activityCode", label: "Activity Code" },
  { key: "pmContact", label: "PM / Contact" },
];

export function ProfileForm({ profile, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSignature(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/image\/(png|jpe?g)/.test(f.type)) {
      alert("Gunakan file PNG atau JPG.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange({ signatureDataUrl: String(reader.result) });
    reader.readAsDataURL(f);
  }

  return (
    <div>
      <div className="grid-2">
        {TEXT_FIELDS.map((f) => (
          <div className="field" key={f.key}>
            <label htmlFor={`p-${f.key}`}>{f.label}</label>
            <input
              id={`p-${f.key}`}
              value={(profile[f.key] as string) ?? ""}
              placeholder={f.placeholder}
              onChange={(e) => onChange({ [f.key]: e.target.value } as Partial<Profile>)}
            />
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="field">
          <label htmlFor="p-dhName">Nama DH (Department Head)</label>
          <input
            id="p-dhName"
            value={profile.dhName}
            placeholder="Elia Dolaciho Bangun"
            onChange={(e) => onChange({ dhName: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="p-tlName">Nama Team Lead</label>
          <input
            id="p-tlName"
            value={profile.teamLeadName}
            placeholder="Moh Adam Alfian"
            onChange={(e) => onChange({ teamLeadName: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="p-tlTitle">Label Kolom Approver Kanan</label>
          <input
            id="p-tlTitle"
            value={profile.teamLeadTitle}
            placeholder="Team Lead"
            onChange={(e) => onChange({ teamLeadTitle: e.target.value })}
          />
          <p className="inline-help">
            Tampil sebagai &quot;Disetujui oleh: {profile.teamLeadTitle || "Team Lead"}&quot;
          </p>
        </div>
        <div className="field">
          <label htmlFor="p-ds">Jam Mulai Default</label>
          <input
            id="p-ds"
            type="time"
            value={profile.defaultStart}
            onChange={(e) => onChange({ defaultStart: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor="p-de">Jam Selesai Default</label>
          <input
            id="p-de"
            type="time"
            value={profile.defaultEnd}
            onChange={(e) => onChange({ defaultEnd: e.target.value })}
          />
        </div>
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <label>Tanda Tangan (PNG/JPG, background transparan/putih)</label>
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => fileRef.current?.click()}
          >
            Upload gambar tanda tangan
          </button>
          {profile.signatureDataUrl && (
            <button
              type="button"
              className="btn ghost"
              onClick={() => onChange({ signatureDataUrl: "" })}
            >
              Hapus
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={handleSignature}
          />
        </div>
        {profile.signatureDataUrl && (
          <div className="sig-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={profile.signatureDataUrl} alt="tanda tangan" />
            <span className="inline-help">Tersimpan di browser ini.</span>
          </div>
        )}
      </div>
    </div>
  );
}
