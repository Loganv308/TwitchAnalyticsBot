// Global variables
let n = 0;

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
export function incrementUp() { 
    n += 1; // Increment the counter
    return n; 
}

export function incrementDown() {
    n -= 1; // Increment the counter
    return n; 
}


// Export function
// ------------------------------------------------
export default {
    formatDate,
    incrementUp
};