import { initializeLanguage } from './dom.js';

// This module is imported before standalone construction: modules that build
// translated labels at import time see the selected locale on their first run.
initializeLanguage();
