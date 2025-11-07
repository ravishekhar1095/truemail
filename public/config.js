/**
 * config.js: Global application configuration.
 * This file defines environment-specific variables, like the API base URL.
 * It should be included before any other application script in the HTML.
 */
window.AppConfig = {
  // Define the API base URL based on the environment.
  API_BASE_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : 'truemailv2-m00ehdxbk-ravis-projects-fef21f80.vercel.app' // Use a relative path for production, so it uses the same domain.
};