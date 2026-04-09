// ─── Counter ───────────────────────────────────────────────────────────────

let n: number = 0;

// ─── Date / Time ───────────────────────────────────────────────────────────

// Formats a Date object into a SQLite-compatible "YYYY-MM-DD HH:MM:SS" string
export function formatDate(date: Date): string {
  const d = new Date(date);

  const formattedDate = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");

  const formattedTime = [
    String(d.getHours()).padStart(2, "0"),
    String(d.getMinutes()).padStart(2, "0"),
    String(d.getSeconds()).padStart(2, "0"),
  ].join(":");

  return `${formattedDate} ${formattedTime}`;
}

// ─── Counter ───────────────────────────────────────────────────────────────

export function incrementUp(): number {
  return ++n;
}

export function incrementDown(): number {
  return --n;
}

// ─── Exports ───────────────────────────────────────────────────────────────

export default {
  formatDate,
  incrementUp,
  incrementDown, // was missing from the original default export
};