/// <reference types="vitest/globals" />

const UTC_RESOLVED_OPTIONS = {
  locale: 'en-US',
  calendar: 'gregory',
  numberingSystem: 'latn',
  timeZone: 'UTC',
  timeZoneName: 'short',
} as const;

// Must run before most setup imports so modules that read browser timezone at
// import time (e.g. timezoneProvider) see a stable UTC value in tests.
vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(
  () => UTC_RESOLVED_OPTIONS
);
