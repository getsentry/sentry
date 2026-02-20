/// <reference types="vitest/globals" />

// With isolate:false, module state can leak between test files within a worker.
// Resetting the module registry here restores per-file mock/import behavior.
vi.resetModules();
