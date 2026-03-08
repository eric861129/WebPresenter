import QRCode from "qrcode";

export async function buildQrCodeDataUrl(value: string) {
  return QRCode.toDataURL(value, {
    width: 256,
    margin: 1,
    color: {
      dark: "#04131f",
      light: "#f4efe4",
    },
  });
}
