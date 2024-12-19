
// Date/Time functions
// ------------------------------------------------
export function formatDate(date, locale = 'en-US') {
    return new Date(date).toLocaleDateString(locale, {
        weekday: "long",
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

// Counter functions
// ------------------------------------------------

export default {
    formatDate
};