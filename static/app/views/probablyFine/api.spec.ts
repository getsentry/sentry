import {scoreIssue, scoreIssues} from './api';
import {MOCK_ISSUES} from './mockData';
import {ActionabilityTier, type Issue} from './types';

describe('Probably Fine API', () => {
  describe('scoreIssue', () => {
    it('returns classification from Seer API when available', async () => {
      // Mock fetch to return a successful response
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tier: 'fix_now',
          confidence: 0.95,
          reasoning: 'Critical production error',
          factors: [
            {
              name: 'Event Count',
              value: '2500 events',
              impact: 'increases_priority',
            },
          ],
        }),
      });

      const issue: Issue = {
        id: 'test-1',
        title: 'Test error',
        message: 'Error message',
        eventCount: 2500,
        userCount: 400,
        firstSeen: '2026-02-17T10:00:00Z',
        environment: 'production',
        level: 'error',
      };

      const result = await scoreIssue(issue);

      expect(result.tier).toBe(ActionabilityTier.FIX_NOW);
      expect(result.confidence).toBe(0.95);
      expect(result.factors).toHaveLength(1);

      // Verify fetch was called with correct params
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:9091/v0/actionability/score',
        expect.objectContaining({
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
        })
      );
    });

    it('falls back to mock data when Seer is unavailable', async () => {
      // Mock fetch to reject (network error)
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      // Use an issue from MOCK_ISSUES that has actionability data
      const issue = MOCK_ISSUES[0];

      const result = await scoreIssue(issue);

      // Should return the mock actionability data
      expect(result).toBeDefined();
      expect(result.tier).toBe(issue.actionability?.tier);
    });

    it('falls back to mock data when Seer returns error status', async () => {
      // Mock fetch to return error status
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const issue = MOCK_ISSUES[1];
      const result = await scoreIssue(issue);

      expect(result).toBeDefined();
      expect(result.tier).toBe(issue.actionability?.tier);
    });

    it('includes all issue fields in API request', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tier: 'review',
          confidence: 0.7,
          reasoning: 'Test',
          factors: [],
        }),
      });

      const issue: Issue = {
        id: 'test-2',
        title: 'Test error',
        message: 'Error message',
        stacktrace: 'at function()',
        eventCount: 100,
        userCount: 10,
        firstSeen: '2026-02-17T10:00:00Z',
        environment: 'staging',
        level: 'warning',
      };

      await scoreIssue(issue);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody).toMatchObject({
        issue_id: 'test-2',
        title: 'Test error',
        message: 'Error message',
        stacktrace: 'at function()',
        event_count: 100,
        user_count: 10,
        first_seen: '2026-02-17T10:00:00Z',
        environment: 'staging',
        level: 'warning',
      });
    });
  });

  describe('scoreIssues', () => {
    it('scores multiple issues in parallel', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          tier: 'review',
          confidence: 0.7,
          reasoning: 'Test',
          factors: [],
        }),
      });

      const issues = MOCK_ISSUES.slice(0, 3);
      const results = await scoreIssues(issues);

      expect(results.size).toBe(3);
      expect(global.fetch).toHaveBeenCalledTimes(3);

      // All issues should have results
      issues.forEach(issue => {
        expect(results.has(issue.id)).toBe(true);
      });
    });

    it('returns results mapped by issue ID', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tier: 'fix_now',
            confidence: 0.9,
            reasoning: 'Test 1',
            factors: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tier: 'probably_fine',
            confidence: 0.8,
            reasoning: 'Test 2',
            factors: [],
          }),
        });

      const issues = MOCK_ISSUES.slice(0, 2);
      const results = await scoreIssues(issues);

      const result1 = results.get(issues[0].id);
      const result2 = results.get(issues[1].id);

      expect(result1?.tier).toBe(ActionabilityTier.FIX_NOW);
      expect(result2?.tier).toBe(ActionabilityTier.PROBABLY_FINE);
    });

    it('handles empty issue list', async () => {
      const results = await scoreIssues([]);

      expect(results.size).toBe(0);
    });

    it('continues scoring other issues if one fails', async () => {
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tier: 'review',
            confidence: 0.7,
            reasoning: 'Test',
            factors: [],
          }),
        });

      const issues = MOCK_ISSUES.slice(0, 2);
      const results = await scoreIssues(issues);

      // Both issues should have results (first falls back to mock)
      expect(results.size).toBe(2);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
