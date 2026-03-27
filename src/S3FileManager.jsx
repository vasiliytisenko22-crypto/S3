import { useState, useRef } from "react";
import "./S3FileManager.css";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";


async function getPresignedUploadUrl(objectKey) {
  const res = await fetch(`${API_BASE}/s3/upload-url?objectKey=${encodeURIComponent(objectKey)}`);
  if (!res.ok) throw new Error(`Не вдалося отримати upload URL: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const url = data.url || data.uploadUrl || data.presignedUrl;
  if (!url) throw new Error("Сервер не повернув URL. Відповідь: " + JSON.stringify(data));
  return url;
}

async function uploadToPresignedUrl(presignedUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ message: "Файл успішно завантажено" });
      } else {
        reject(new Error(`Помилка PUT: ${xhr.status} ${xhr.statusText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Помилка мережі під час PUT завантаження"));
    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.send(file);
  });
}

async function getTemporaryUrl(objectKey) {
  const res = await fetch(`${API_BASE}/s3?objectKey=${encodeURIComponent(objectKey)}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Не вдалося отримати посилання: ${res.status} ${res.statusText}`);
  return res.json();
}

async function deleteFile(objectKey) {
  const res = await fetch(`${API_BASE}/s3?objectKey=${encodeURIComponent(objectKey)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Помилка видалення: ${res.status} ${res.statusText}`);
  const text = await res.text();
  return text ? JSON.parse(text) : { message: "Файл видалено" };
}


function ProgressBar({ value }) {
  return (
    <div className="progress-wrapper">
      <p className="progress-label">Завантаження… {value}%</p>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Badge({ type, children }) {
  return <span className={`badge badge--${type}`}>{children}</span>;
}

function Card({ title, children }) {
  return (
    <div className="card">
      <h2 className="card__title">{title}</h2>
      {children}
    </div>
  );
}


export default function S3FileManager() {

  // -- Presigned upload стан
  const [presignedKey, setPresignedKey] = useState("");
  const [presignedFile, setPresignedFile] = useState(null);
  const [presignedProgress, setPresignedProgress] = useState(0);
  const [presignedLoading, setPresignedLoading] = useState(false);
  const [presignedResult, setPresignedResult] = useState(null);
  const [presignedError, setPresignedError] = useState(null);
  const presignedInputRef = useRef(null);

  // -- Get URL стан
  const [urlKey, setUrlKey] = useState("");
  const [urlResult, setUrlResult] = useState(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState(null);

  // -- Delete стан
  const [deleteKey, setDeleteKey] = useState("");
  const [deleteResult, setDeleteResult] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);


  const handlePresignedUpload = async () => {
    if (!presignedKey.trim() || !presignedFile) return;
    setPresignedLoading(true);
    setPresignedProgress(0);
    setPresignedResult(null);
    setPresignedError(null);
    try {
      const uploadUrl = await getPresignedUploadUrl(presignedKey.trim());
      await uploadToPresignedUrl(uploadUrl, presignedFile, setPresignedProgress);
      setPresignedResult({ message: "Файл успішно завантажено", key: presignedKey.trim() });
      setPresignedFile(null);
      if (presignedInputRef.current) presignedInputRef.current.value = "";
    } catch (err) {
      setPresignedError(err.message);
    } finally {
      setPresignedLoading(false);
    }
  };

  const handleGetUrl = async () => {
    if (!urlKey.trim()) return;
    setUrlLoading(true);
    setUrlResult(null);
    setUrlError(null);
    try {
      const result = await getTemporaryUrl(urlKey.trim());
      setUrlResult(result);
    } catch (err) {
      setUrlError(err.message);
    } finally {
      setUrlLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteKey.trim()) return;
    setDeleteLoading(true);
    setDeleteResult(null);
    setDeleteError(null);
    try {
      const result = await deleteFile(deleteKey.trim());
      setDeleteResult(result);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };


  return (
    <div className="s3-manager">

      {/* ── PRESIGNED UPLOAD ── */}
      <Card title="Завантажити файл">
        <div className="presigned-form">
          <input
            className="input-row__field"
            type="text"
            placeholder="Ключ файлу (наприклад moon.jpg)"
            value={presignedKey}
            onChange={(e) => setPresignedKey(e.target.value)}
          />

          <div
            className={`upload-zone upload-zone--small${presignedFile ? " upload-zone--has-file" : ""}`}
            onClick={() => !presignedFile && presignedInputRef.current?.click()}
          >
            {presignedFile ? (
              <>
                <p className="upload-zone__label">{presignedFile.name}</p>
                <p className="upload-zone__hint">{(presignedFile.size / 1024).toFixed(1)} КБ</p>
              </>
            ) : (
              <>
                <p className="upload-zone__label">Натисніть щоб обрати файл</p>
                <p className="upload-zone__hint">Підтримуються будь-які формати файлів</p>
              </>
            )}
            <input
              ref={presignedInputRef}
              type="file"
              style={{ display: "none" }}
              onChange={(e) => { if (e.target.files.length) setPresignedFile(e.target.files[0]); }}
            />
          </div>

          {presignedFile && !presignedLoading && (
            <div className="upload-zone__actions">
              <button
                className="btn btn--primary"
                onClick={handlePresignedUpload}
                disabled={!presignedKey.trim()}
              >
                Відправити
              </button>
              <button
                className="btn btn--cancel"
                onClick={() => {
                  setPresignedFile(null);
                  setPresignedResult(null);
                  setPresignedError(null);
                  if (presignedInputRef.current) presignedInputRef.current.value = "";
                }}
              >
                Скасувати
              </button>
            </div>
          )}

          {presignedLoading && <ProgressBar value={presignedProgress} />}
        </div>

        {presignedResult && !presignedLoading && (
          <div className="result">
            <Badge type="success">Завантажено</Badge>
            <p className="result__key">Ключ: <code>{presignedResult.key}</code></p>
          </div>
        )}
        {presignedError && !presignedLoading && (
          <div className="error">
            <Badge type="error">Помилка</Badge>
            <p className="error__message">{presignedError}</p>
          </div>
        )}
      </Card>

      {/* ── GET TEMP URL ── */}
      <Card title="Отримати тимчасове посилання">
        <div className="input-row">
          <input
            className="input-row__field"
            type="text"
            placeholder="Ключ файлу (наприклад moon.jpg)"
            value={urlKey}
            onChange={(e) => setUrlKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGetUrl()}
          />
          <button
            className="btn btn--primary"
            onClick={handleGetUrl}
            disabled={urlLoading || !urlKey.trim()}
          >
            {urlLoading ? "Завантаження…" : "Отримати"}
          </button>
        </div>
        {urlResult && (
          <div className="result">
            <Badge type="success">Посилання отримано</Badge>
            <pre className="result__json">{JSON.stringify(urlResult, null, 2)}</pre>
            {(urlResult.url || urlResult.signedUrl || urlResult.presignedUrl) && (
              <a
                className="result__link"
                href={urlResult.url || urlResult.signedUrl || urlResult.presignedUrl}
                target="_blank"
                rel="noreferrer"
              >
                Відкрити файл ↗
              </a>
            )}
          </div>
        )}
        {urlError && (
          <div className="error">
            <Badge type="error">Помилка</Badge>
            <p className="error__message">{urlError}</p>
          </div>
        )}
      </Card>

      {/* ── DELETE ── */}
      <Card title="Видалити файл">
        <div className="input-row">
          <input
            className="input-row__field"
            type="text"
            placeholder="Ключ файлу (наприклад moon.jpg)"
            value={deleteKey}
            onChange={(e) => setDeleteKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleDelete()}
          />
          <button
            className="btn btn--danger"
            onClick={handleDelete}
            disabled={deleteLoading || !deleteKey.trim()}
          >
            {deleteLoading ? "Видалення…" : "Видалити"}
          </button>
        </div>
        {deleteResult && (
          <div className="result">
            <Badge type="success">Видалено</Badge>
            <pre className="result__json">{JSON.stringify(deleteResult, null, 2)}</pre>
          </div>
        )}
        {deleteError && (
          <div className="error">
            <Badge type="error">Помилка</Badge>
            <p className="error__message">{deleteError}</p>
          </div>
        )}
      </Card>

    </div>
  );
}