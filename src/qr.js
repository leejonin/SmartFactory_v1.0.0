import QRCode from 'qrcode';
import jsQR from 'jsqr';

export const REGIONS = ['목동', '합정동', '면목동'];
/** 목적지별 실제 QR 모듈을 RGBA 이미지로 만든다. SW_Browser_Logistics_001 */
export function encodeRegion(region) {
  const code = QRCode.create(JSON.stringify({ destination: region }), { errorCorrectionLevel: 'M' });
  const scale = 6, border = 4, width = (code.modules.size + border * 2) * scale;
  const data = new Uint8ClampedArray(width * width * 4);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const mx = Math.floor(x / scale) - border, my = Math.floor(y / scale) - border;
    const dark = mx >= 0 && my >= 0 && mx < code.modules.size && my < code.modules.size && code.modules.get(my, mx);
    const i = (y * width + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = dark ? 10 : 255;
    data[i + 3] = 255;
  }
  return { data, width, height: width };
}
/** QR 픽셀을 판독하고 허용된 목적지만 반환한다. 실패 시 null이며 원래 배정값으로 우회하지 않는다. */
export function decodeRegion(pixels, allowedRegions = REGIONS) {
  if (!pixels) return null;
  const result = jsQR(pixels.data, pixels.width, pixels.height);
  try {
    const destination = JSON.parse(result?.data).destination;
    return allowedRegions.includes(destination) ? destination : null;
  } catch { return null; }
}
