type Props = {
  open: boolean;
  peerId: string | null;
  qrDataUrl: string | null;
  remoteLink: string | null;
  onClose: () => void;
};

export function RemoteQrModal({ open, peerId, qrDataUrl, remoteLink, onClose }: Props) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card" role="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Remote Pairing</p>
            <h2>Scan to connect your phone</h2>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="qr-layout">
          {qrDataUrl ? <img alt="remote control QR code" className="qr-image" src={qrDataUrl} /> : null}
          <div className="status-card">
            <p>Peer ID</p>
            <strong>{peerId ?? "Starting..."}</strong>
            {remoteLink ? (
              <a href={remoteLink} rel="noreferrer" target="_blank">
                Open remote link
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
