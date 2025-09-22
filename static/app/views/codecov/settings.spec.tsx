import {
  AI_BASE_URL,
  AI_PAGE_TITLE,
  CODECOV_BASE_URL,
  CODECOV_PAGE_TITLE,
  COVERAGE_BASE_URL,
  COVERAGE_PAGE_TITLE,
  TESTS_BASE_URL,
  TESTS_PAGE_TITLE,
  TOKENS_BASE_URL,
  TOKENS_PAGE_TITLE,
} from 'sentry/views/codecov/settings';

describe('Codecov Settings', () => {
  it('exports the correct page titles', () => {
    expect(CODECOV_PAGE_TITLE).toBe('Codecov');
    expect(COVERAGE_PAGE_TITLE).toBe('Code Coverage');
    expect(TESTS_PAGE_TITLE).toBe('Test Analytics');
    expect(AI_PAGE_TITLE).toBe('Prevent AI');
    expect(TOKENS_PAGE_TITLE).toBe('Tokens');
  });

  it('exports the correct base URLs', () => {
    expect(CODECOV_BASE_URL).toBe('codecov');
    expect(COVERAGE_BASE_URL).toBe('coverage');
    expect(TESTS_BASE_URL).toBe('tests');
    expect(AI_BASE_URL).toBe('ai');
    expect(TOKENS_BASE_URL).toBe('tokens');
  });
});
