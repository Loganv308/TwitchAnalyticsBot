// Global variables
let n = 0;

// Date/Time functions
// ------------------------------------------------
export function formatDate(date) {
    const d = new Date(date);
    
    const formattedDate = [
        d.getFullYear(), // YYYY
        String(d.getMonth() + 1).padStart(2, '0'), // MM
        String(d.getDate()).padStart(2, '0') // DD
    ].join('-');

    const formattedTime = [
        String(d.getHours()).padStart(2, '0'), // HH
        String(d.getMinutes()).padStart(2, '0'), // MM
        String(d.getSeconds()).padStart(2, '0') // SS
    ].join(':');

    return `${formattedDate} ${formattedTime}`;
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