import { useTranslation } from "react-i18next";

type Props = {
  open: boolean;
  peerId: string | null;
  qrDataUrl: string | null;
  remoteLink: string | null;
  onClose: () => void;
};

export function RemoteQrModal({ open, peerId, qrDataUrl, remoteLink, onClose }: Props) {
  const { t } = useTranslation();

  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card" role="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">{t("remoteModal.eyebrow")}</p>
            <h2>{t("remoteModal.title")}</h2>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            {t("common.close")}
          </button>
        </div>
        <div className="qr-layout">
          {qrDataUrl ? <img alt="remote control QR code" className="qr-image" src={qrDataUrl} /> : null}
          <div className="status-card">
            <p>{t("remoteModal.peerId")}</p>
            <strong>{peerId ?? "Starting..."}</strong>
            {remoteLink ? (
              <a href={remoteLink} rel="noreferrer" target="_blank">
                {t("remoteModal.openLink")}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
