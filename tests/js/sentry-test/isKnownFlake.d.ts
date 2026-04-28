declare namespace jest {
  interface It {
    /**
     * Marks a test as a known flake. When the RERUN_KNOWN_FLAKY_TESTS env var
     * is set (via the "Frontend: Rerun Flaky Tests" PR label), the test runs
     * 50x to validate that a fix is stable. Otherwise it runs once, normally.
     *
     * Available globally — no import needed.
     */
    isKnownFlake(name: string, fn: jest.ProvidesCallback, timeout?: number): void;
  }
}
