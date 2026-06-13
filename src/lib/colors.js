// Tiny zero-dependency color helper. Respects NO_COLOR and non-TTY output.
const ESC = String.fromCharCode(27);
const enabled = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (open, close) => (s) =>
  enabled ? `${ESC}[${open}m${s}${ESC}[${close}m` : String(s);

export default {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  cyan: wrap(36, 39),
};
