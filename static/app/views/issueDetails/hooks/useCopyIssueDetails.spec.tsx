import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {renderHook, userEvent} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import * as explorerAutofixHooks from 'sentry/components/events/autofix/useExplorerAutofix';
import {ConfigStore} from 'sentry/stores/configStore';
import {EntryType} from 'sentry/types/event';
import {IssueCategory, IssueType} from 'sentry/types/group';
import * as copyToClipboardModule from 'sentry/utils/useCopyToClipboard';
import * as useOrganization from 'sentry/utils/useOrganization';
import {formatSpanEvidenceToMarkdown} from 'sentry/views/issueDetails/hooks/spanEvidenceMarkdown';
import {
  issueAndEventToMarkdown,
  useCopyIssueDetails,
} from 'sentry/views/issueDetails/hooks/useCopyIssueDetails';

jest.mock('sentry/utils/useCopyToClipboard');

describe('useCopyIssueDetails', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture();
  // Span Evidence gating uses the issue type config, which is keyed off the
  // group's category/type — performance issues must use a performance group.
  const performanceGroup = GroupFixture({
    issueCategory: IssueCategory.PERFORMANCE,
    issueType: IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
  });
  const endpointRegressionGroup = GroupFixture({
    issueCategory: IssueCategory.PERFORMANCE,
    issueType: IssueType.PERFORMANCE_ENDPOINT_REGRESSION,
  });
  const functionRegressionGroup = GroupFixture({
    issueCategory: IssueCategory.PERFORMANCE,
    issueType: IssueType.PROFILE_FUNCTION_REGRESSION,
  });
  const event = EventFixture({
    id: '123456',
    dateCreated: '2023-01-01T00:00:00Z',
  });

  const mockAutofixData: ExplorerAutofixState = {
    run_id: 123,
    status: 'completed',
    updated_at: '2023-01-01T00:00:00Z',
    blocks: [
      {
        id: 'root-cause-block',
        message: {
          role: 'assistant' as const,
          content: 'Found the root cause',
          metadata: {step: 'root_cause'},
        },
        timestamp: '2023-01-01T00:00:00Z',
        loading: false,
        artifacts: [
          {
            key: 'root_cause',
            reason: 'Root cause analysis',
            data: {
              one_line_description: 'Root cause text',
              five_whys: ['Why 1'],
            },
          },
        ],
      },
      {
        id: 'solution-block',
        message: {
          role: 'assistant' as const,
          content: 'Here is the solution',
          metadata: {step: 'solution'},
        },
        timestamp: '2023-01-01T00:00:01Z',
        loading: false,
        artifacts: [
          {
            key: 'solution',
            reason: 'Solution plan',
            data: {
              one_line_summary: 'Solution title',
              steps: [{title: 'Fix it', description: 'Solution text'}],
            },
          },
        ],
      },
    ],
  };

  describe('issueAndEventToMarkdown', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('formats basic issue information correctly', () => {
      const result = issueAndEventToMarkdown({group, event, organization});

      expect(result).toContain(`# ${group.title}`);
      expect(result).toContain(`**Issue ID:** ${group.id}`);
      expect(result).toContain(`**Short ID:** ${group.shortId}`);
      expect(result).toContain(`**Project:** ${group.project?.slug}`);
    });

    it("renders the date in the user's timezone and clock preference", () => {
      const user = UserFixture();
      user.options.timezone = 'America/New_York';
      user.options.clock24Hours = false;
      ConfigStore.set('user', user);

      try {
        const result = issueAndEventToMarkdown({group, event, organization});

        // dateCreated is 2023-01-01T00:00:00Z, which is EST (UTC-5) in New York,
        // and the timezone abbreviation is appended so it's unambiguous.
        expect(result).toContain('**Date:** Dec 31, 2022 7:00:00 PM EST');
      } finally {
        ConfigStore.set('user', UserFixture());
      }
    });

    it("renders the date with the user's 24-hour clock preference", () => {
      const user = UserFixture();
      user.options.timezone = 'America/New_York';
      user.options.clock24Hours = true;
      ConfigStore.set('user', user);

      try {
        const result = issueAndEventToMarkdown({group, event, organization});

        expect(result).toContain('**Date:** Dec 31, 2022 19:00:00 EST');
      } finally {
        ConfigStore.set('user', UserFixture());
      }
    });

    it('falls back to dateReceived when dateCreated is absent', () => {
      const user = UserFixture();
      user.options.timezone = 'America/New_York';
      user.options.clock24Hours = false;
      ConfigStore.set('user', user);

      // Transaction/performance events (e.g. N+1 DB) carry dateReceived but not
      // dateCreated.
      const performanceEvent = EventFixture({
        id: '123456',
        dateCreated: undefined,
        dateReceived: '2023-01-01T00:00:00Z',
      });

      try {
        const result = issueAndEventToMarkdown({
          group: performanceGroup,
          event: performanceEvent,
          organization,
        });

        expect(result).toContain('**Date:** Dec 31, 2022 7:00:00 PM EST');
      } finally {
        ConfigStore.set('user', UserFixture());
      }
    });

    it('includes autofix data when provided', () => {
      const result = issueAndEventToMarkdown({
        group,
        event,
        autofixData: mockAutofixData,
        organization,
      });

      expect(result).toContain('## Root Cause');
      expect(result).toContain('## Plan');
    });

    it('includes the message when it differs from the title', () => {
      const result = issueAndEventToMarkdown({
        group: GroupFixture({title: 'TypeError'}),
        event: EventFixture({...event, message: 'Connection to database timed out'}),
        organization,
      });

      expect(result).toContain('## Message');
      expect(result).toContain('Connection to database timed out');
    });

    it('omits the message when it is already part of the title', () => {
      const result = issueAndEventToMarkdown({
        group: GroupFixture({title: 'TypeError: connection failed'}),
        event: EventFixture({...event, message: 'connection failed'}),
        organization,
      });

      expect(result).not.toContain('## Message');
    });

    it('omits the message when it is empty', () => {
      const result = issueAndEventToMarkdown({
        group: GroupFixture({title: 'TypeError'}),
        event: EventFixture({...event, message: '   '}),
        organization,
      });

      expect(result).not.toContain('## Message');
    });

    it('includes tags when present in event', () => {
      const eventWithTags = {
        ...event,
        tags: [
          {key: 'browser', value: 'Chrome'},
          {key: 'device', value: 'iPhone'},
        ],
      };

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithTags,
        organization,
      });

      expect(result).toContain('## Tags');
      expect(result).toContain('**browser:** Chrome');
      expect(result).toContain('**device:** iPhone');
    });

    it('includes exception data when present', () => {
      // Create an event fixture with exception entries
      const eventWithException = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.EXCEPTION,
            data: {
              values: [
                {
                  type: 'TypeError',
                  value: 'Cannot read property of undefined',
                  stacktrace: {
                    frames: [
                      {
                        function: 'testFunction',
                        filename: 'test.js',
                        lineNo: 42,
                        colNo: 13,
                        inApp: true,
                        context: [[42, 'const value = obj.property;']],
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      });

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithException,
        organization,
      });

      expect(result).toContain('## Exception');
      expect(result).toContain('**Type:** TypeError');
      expect(result).toContain('**Value:** Cannot read property of undefined');
      expect(result).toContain('#### Stacktrace');
      // No mechanism on this exception, so no handled line.
      expect(result).not.toContain('**Handled:**');
    });

    it('marks an unhandled exception', () => {
      const eventWithUnhandled = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.EXCEPTION,
            data: {
              values: [
                {
                  type: 'TypeError',
                  value: 'boom',
                  mechanism: {type: 'onerror', handled: false},
                },
              ],
            },
          },
        ],
      });

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithUnhandled,
        organization,
      });

      expect(result).toContain('**Handled:** No');
    });

    it('marks a handled exception', () => {
      const eventWithHandled = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.EXCEPTION,
            data: {
              values: [
                {
                  type: 'ValueError',
                  value: 'caught',
                  mechanism: {type: 'generic', handled: true},
                },
              ],
            },
          },
        ],
      });

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithHandled,
        organization,
      });

      expect(result).toContain('**Handled:** Yes');
    });

    it('includes thread stacktrace when activeThreadId matches', () => {
      const eventWithThreads = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.THREADS,
            data: {
              values: [
                {
                  id: 1,
                  name: 'Main Thread',
                  crashed: true,
                  current: true,
                  stacktrace: {
                    frames: [
                      {
                        function: 'mainFunction',
                        filename: 'main.py',
                        lineNo: 10,
                        inApp: true,
                      },
                    ],
                  },
                },
                {
                  id: 2,
                  name: 'Worker Thread',
                  crashed: false,
                  current: false,
                  stacktrace: {
                    frames: [
                      {
                        function: 'workerFunction',
                        filename: 'worker.py',
                        lineNo: 25,
                        inApp: true,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      });

      // Pass activeThreadId = 1 to select Main Thread
      const result = issueAndEventToMarkdown({
        group,
        event: eventWithThreads,
        activeThreadId: 1,
        organization,
      });

      expect(result).toContain('## Thread: Main Thread');
      expect(result).toContain('(crashed)');
      expect(result).toContain('(current)');
      expect(result).toContain('mainFunction');
      expect(result).toContain('main.py');
      expect(result).not.toContain('Worker Thread');
      expect(result).not.toContain('workerFunction');
    });

    it('includes different thread when activeThreadId changes', () => {
      const eventWithThreads = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.THREADS,
            data: {
              values: [
                {
                  id: 1,
                  name: 'Main Thread',
                  crashed: true,
                  current: true,
                  stacktrace: {
                    frames: [
                      {
                        function: 'mainFunction',
                        filename: 'main.py',
                        lineNo: 10,
                        inApp: true,
                      },
                    ],
                  },
                },
                {
                  id: 2,
                  name: 'Worker Thread',
                  crashed: false,
                  current: false,
                  stacktrace: {
                    frames: [
                      {
                        function: 'workerFunction',
                        filename: 'worker.py',
                        lineNo: 25,
                        inApp: true,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      });

      // Pass activeThreadId = 2 to select Worker Thread
      const result = issueAndEventToMarkdown({
        group,
        event: eventWithThreads,
        activeThreadId: 2,
        organization,
      });

      expect(result).toContain('## Thread: Worker Thread');
      expect(result).not.toContain('(crashed)');
      expect(result).not.toContain('(current)');
      expect(result).toContain('workerFunction');
      expect(result).toContain('worker.py');
      expect(result).not.toContain('Main Thread');
      expect(result).not.toContain('mainFunction');
    });

    it('does not include thread stacktrace when activeThreadId is undefined', () => {
      const eventWithThreads = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.THREADS,
            data: {
              values: [
                {
                  id: 1,
                  name: 'Main Thread',
                  crashed: true,
                  current: true,
                  stacktrace: {
                    frames: [
                      {
                        function: 'mainFunction',
                        filename: 'main.py',
                        lineNo: 10,
                        inApp: true,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      });

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithThreads,
        organization,
      });

      expect(result).not.toContain('## Thread');
      expect(result).not.toContain('mainFunction');
    });

    it('includes breadcrumbs when present in event', () => {
      const eventWithBreadcrumbs = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.BREADCRUMBS,
            data: {
              values: [
                {
                  type: 'http',
                  category: 'fetch',
                  level: 'error',
                  message: 'GET /api/users',
                  data: {url: '/api/users', status_code: 500},
                },
                {
                  type: 'navigation',
                  category: 'ui.click',
                  level: 'info',
                  message: 'User clicked submit',
                  data: null,
                },
              ],
            },
          },
        ],
      });

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithBreadcrumbs,
        organization,
      });

      expect(result).toContain('## Breadcrumbs');
      expect(result).toContain('- **http** `fetch` [error]');
      expect(result).toContain('  GET /api/users');
      expect(result).toContain('  {"url":"/api/users","status_code":500}');
      expect(result).toContain('- **navigation** `ui.click` [info]');
      expect(result).toContain('  User clicked submit');
    });

    it('truncates a single breadcrumb to the per-crumb character limit', () => {
      const longMessage = 'x'.repeat(600);
      const eventWithLongBreadcrumb = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.BREADCRUMBS,
            data: {
              values: [{type: 'default', level: 'info', message: longMessage}],
            },
          },
        ],
      });

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithLongBreadcrumb,
        organization,
      });

      // Kept the first 500 chars plus an ellipsis, dropped the rest.
      expect(result).toContain(`${'x'.repeat(500)}...`);
      expect(result).not.toContain('x'.repeat(501));
    });

    it('truncates the breadcrumbs section to the total character limit', () => {
      // 10 crumbs near the per-crumb cap (~490 chars each) overflow the 5000
      // total. The first crumb's content survives; the last crumb's tail (well
      // past the 5000th char) is cut off.
      const values = Array.from({length: 10}, (_, i) => {
        if (i === 0) {
          return {type: 'default', level: 'info', message: `FIRSTHEAD${'a'.repeat(481)}`};
        }
        if (i === 9) {
          return {
            type: 'default',
            level: 'info',
            message: `LASTHEAD${'a'.repeat(470)}LASTTAIL`,
          };
        }
        return {type: 'default', level: 'info', message: 'a'.repeat(490)};
      });
      const eventWithManyLargeBreadcrumbs = EventFixture({
        ...event,
        entries: [{type: EntryType.BREADCRUMBS, data: {values}}],
      });

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithManyLargeBreadcrumbs,
        organization,
      });

      expect(result).toContain('... (breadcrumbs truncated to first 5,000 characters)');
      expect(result).toContain('FIRSTHEAD');
      expect(result).not.toContain('LASTTAIL');
    });

    it('renders breadcrumbs after exceptions', () => {
      const eventWithBoth = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.BREADCRUMBS,
            data: {
              values: [{type: 'default', level: 'info', message: 'crumb'}],
            },
          },
          {
            type: EntryType.EXCEPTION,
            data: {
              values: [{type: 'TypeError', value: 'boom'}],
            },
          },
        ],
      });

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithBoth,
        organization,
      });

      expect(result.indexOf('## Exception')).toBeLessThan(
        result.indexOf('## Breadcrumbs')
      );
    });

    it('limits breadcrumbs to the most recent 10', () => {
      const values = Array.from({length: 15}, (_, i) => ({
        type: 'default',
        level: 'info',
        message: `crumb ${i}`,
      }));
      const eventWithManyBreadcrumbs = EventFixture({
        ...event,
        entries: [{type: EntryType.BREADCRUMBS, data: {values}}],
      });

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithManyBreadcrumbs,
        organization,
      });

      // The oldest 5 are dropped, the most recent 10 are kept.
      expect(result).not.toContain('crumb 4');
      expect(result).toContain('crumb 5');
      expect(result).toContain('crumb 14');
    });

    it('skips breadcrumbs with filtered content', () => {
      const eventWithFiltered = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.BREADCRUMBS,
            data: {
              values: [
                {type: 'http', level: 'info', message: 'token: [Filtered]'},
                {
                  type: 'http',
                  level: 'info',
                  message: 'visible',
                  data: {secret: '[Filtered]'},
                },
                {type: 'default', level: 'info', message: 'kept crumb'},
              ],
            },
          },
        ],
      });

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithFiltered,
        organization,
      });

      expect(result).toContain('kept crumb');
      expect(result).not.toContain('[Filtered]');
      expect(result).not.toContain('visible');
    });

    it('does not include a breadcrumbs section when there are none', () => {
      const eventWithEmptyBreadcrumbs = EventFixture({
        ...event,
        entries: [{type: EntryType.BREADCRUMBS, data: {values: []}}],
      });

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithEmptyBreadcrumbs,
        organization,
      });

      expect(result).not.toContain('## Breadcrumbs');
    });

    it('includes the request method, url, and body when present', () => {
      const eventWithRequest = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.REQUEST,
            data: {
              method: 'POST',
              url: 'https://example.com/api/checkout/',
              data: {cart_id: 'abc123', total: 4200},
            },
          },
        ],
      });

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithRequest,
        organization,
      });

      expect(result).toContain('## Request');
      expect(result).toContain('POST https://example.com/api/checkout/');
      expect(result).toContain('Body:');
      expect(result).toContain('"cart_id": "abc123"');
    });

    it('renders a string request body as-is', () => {
      const eventWithStringBody = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.REQUEST,
            data: {
              method: 'GET',
              url: 'https://example.com/api/items/',
              data: 'raw body payload',
            },
          },
        ],
      });

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithStringBody,
        organization,
      });

      expect(result).toContain('GET https://example.com/api/items/');
      expect(result).toContain('raw body payload');
    });

    it('renders the request after breadcrumbs', () => {
      const eventWithBoth = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.REQUEST,
            data: {method: 'GET', url: 'https://example.com/', data: null},
          },
          {
            type: EntryType.BREADCRUMBS,
            data: {values: [{type: 'default', level: 'info', message: 'crumb'}]},
          },
        ],
      });

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithBoth,
        organization,
      });

      expect(result.indexOf('## Breadcrumbs')).toBeLessThan(result.indexOf('## Request'));
    });

    it('truncates a large request body to the character limit', () => {
      const eventWithLargeBody = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.REQUEST,
            data: {
              method: 'POST',
              url: 'https://example.com/api/upload/',
              data: 'z'.repeat(2500),
            },
          },
        ],
      });

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithLargeBody,
        organization,
      });

      expect(result).toContain(`${'z'.repeat(2000)}...`);
      expect(result).not.toContain('z'.repeat(2001));
    });

    it('does not include a request section when there is no request data', () => {
      const eventWithEmptyRequest = EventFixture({
        ...event,
        entries: [
          {
            type: EntryType.REQUEST,
            data: {method: null, url: '', data: null},
          },
        ],
      });

      const result = issueAndEventToMarkdown({
        group,
        event: eventWithEmptyRequest,
        organization,
      });

      expect(result).not.toContain('## Request');
    });

    // 1006 is the occurrence type for N+1 DB Queries. Spans mirror the classic
    // cache-miss → DB-read shape: each offender is a cache.get with a distinct
    // key followed by an identical parameterized query.
    const SENTRY_OPTION_SQL = `SELECT sentry_option.id, sentry_option.key, sentry_option.value
FROM sentry_option
WHERE sentry_option.key = %s
LIMIT 21`;

    const nPlusOneEvent = EventFixture({
      ...event,
      title: '/api/0/relays/projectconfigs/',
      startTimestamp: 0,
      endTimestamp: 1,
      occurrence: {
        type: 1006,
        evidenceData: {
          parentSpanIds: ['parent'],
          causeSpanIds: ['cause1', 'cause2'],
          offenderSpanIds: ['cache1', 'db1', 'cache2', 'db2'],
          patternSize: 4,
        },
        evidenceDisplay: [],
      },
      entries: [
        {
          type: EntryType.SPANS,
          data: [
            {
              span_id: 'parent',
              op: 'base.dispatch.execute',
              description: 'RelayProjectConfigsEndpoint.post',
              start_timestamp: 0,
              timestamp: 1,
            },
            {span_id: 'cause1', op: 'db', description: SENTRY_OPTION_SQL},
            {span_id: 'cause2', op: 'db', description: SENTRY_OPTION_SQL},
            {span_id: 'cache1', op: 'cache.get', description: 'o:abc'},
            {
              span_id: 'db1',
              op: 'db',
              description: SENTRY_OPTION_SQL,
              start_timestamp: 0,
              timestamp: 0.011,
              data: {
                'code.filepath': 'src/sentry/relay/config/__init__.py',
                'code.lineno': 212,
                'code.function': 'get_project_config',
              },
            },
            {span_id: 'cache2', op: 'cache.get', description: 'o:def'},
            {
              span_id: 'db2',
              op: 'db',
              description: SENTRY_OPTION_SQL,
              start_timestamp: 0.011,
              timestamp: 0.02,
            },
          ],
        },
      ],
    });

    it('summarizes N+1 span evidence with dedup, cardinality, code and timing', () => {
      expect(formatSpanEvidenceToMarkdown(nPlusOneEvent, organization, performanceGroup))
        .toMatchInlineSnapshot(`
        "
        ## Span Evidence

        **Transaction:** /api/0/relays/projectconfigs/
        **Parent Span:** base.dispatch.execute - RelayProjectConfigsEndpoint.post
        **Preceding Spans (2):**
        - \`db\` (2×, 0ms, 0% of txn):
        \`\`\`sql
        SELECT sentry_option.id, sentry_option.key, sentry_option.value
        FROM sentry_option
        WHERE sentry_option.key = %s
        LIMIT 21
        \`\`\`
        **Offending Spans (4):**
        - \`cache.get\` (2×, 2 distinct keys, 0ms, 0% of txn)
          - o:abc
          - o:def
        - \`db\` (2×, 20ms, 2% of txn):
        \`\`\`sql
        SELECT sentry_option.id, sentry_option.key, sentry_option.value
        FROM sentry_option
        WHERE sentry_option.key = %s
        LIMIT 21
        \`\`\`
          code: src/sentry/relay/config/__init__.py:212 get_project_config
        _Pattern: cache miss → DB read, repeated per entity._
        **Pattern Size:** 4
        "
      `);
    });

    it('dedupes repeated queries instead of printing every span', () => {
      const result = issueAndEventToMarkdown({
        group: performanceGroup,
        event: nPlusOneEvent,
        organization,
      });

      // The identical query collapses to one fenced block per group (preceding +
      // offending) rather than once per span.
      expect(result.match(/```sql/g) ?? []).toHaveLength(2);

      // Regression guard against the previous double-print bug: a single
      // Offending heading and a single Pattern Size line.
      expect(result.match(/Offending Spans/g) ?? []).toHaveLength(1);
      expect(result.match(/Pattern Size/g) ?? []).toHaveLength(1);
    });

    it('caps sample lines across the section for many distinct offenders', () => {
      // Three ops, each with 6 distinct (non-DB) descriptions = 18 distinct
      // values. The per-section budget should hold total samples to 10.
      const makeSpans = (op: string, prefix: string) =>
        Array.from({length: 6}, (_, i) => ({
          span_id: `${prefix}${i}`,
          op,
          description: `${prefix} request ${i}`,
        }));
      const offenders = [
        ...makeSpans('http.client', 'http'),
        ...makeSpans('cache.get', 'cache'),
        ...makeSpans('custom.op', 'custom'),
      ];

      const manyOffenderEvent = EventFixture({
        ...event,
        title: '/api/0/widgets/',
        startTimestamp: 0,
        endTimestamp: 1,
        occurrence: {
          type: 1010, // N+1 API Calls
          evidenceData: {offenderSpanIds: offenders.map(s => s.span_id)},
          evidenceDisplay: [],
        },
        entries: [{type: EntryType.SPANS, data: offenders}],
      });

      const result = issueAndEventToMarkdown({
        group: performanceGroup,
        event: manyOffenderEvent,
        organization,
      });

      // Count indented sample bullets that are actual values (exclude "…and more").
      const sampleLines = (result.match(/^ {2}- (?!…)/gm) ?? []).length;
      expect(sampleLines).toBeLessThanOrEqual(10);
      // Omission is still communicated.
      expect(result).toContain('more');
    });

    it('shares the sample budget across preceding and offending spans', () => {
      // Both span groups have enough distinct values to each exhaust the cap;
      // the budget is shared across the section, so the total stays bounded
      // rather than doubling.
      const makeSpans = (op: string, prefix: string) =>
        Array.from({length: 6}, (_, i) => ({
          span_id: `${prefix}${i}`,
          op,
          description: `${prefix} ${i}`,
        }));
      const precedingSpans = [
        ...makeSpans('http.client', 'pre-http'),
        ...makeSpans('cache.get', 'pre-cache'),
        ...makeSpans('custom.op', 'pre-custom'),
      ];
      const offendingSpans = [
        ...makeSpans('http.client', 'off-http'),
        ...makeSpans('cache.get', 'off-cache'),
        ...makeSpans('custom.op', 'off-custom'),
      ];

      const bothGroupsEvent = EventFixture({
        ...event,
        title: '/api/0/things/',
        startTimestamp: 0,
        endTimestamp: 1,
        occurrence: {
          type: 1006,
          evidenceData: {
            causeSpanIds: precedingSpans.map(s => s.span_id),
            offenderSpanIds: offendingSpans.map(s => s.span_id),
          },
          evidenceDisplay: [],
        },
        entries: [{type: EntryType.SPANS, data: [...precedingSpans, ...offendingSpans]}],
      });

      const result = issueAndEventToMarkdown({
        group: performanceGroup,
        event: bothGroupsEvent,
        organization,
      });

      const sampleLines = (result.match(/^ {2}- (?!…)/gm) ?? []).length;
      expect(sampleLines).toBeLessThanOrEqual(10);
    });

    it('includes payload size for large HTTP payload issues', () => {
      const payloadGroup = GroupFixture({
        issueCategory: IssueCategory.PERFORMANCE,
        issueType: IssueType.PERFORMANCE_LARGE_HTTP_PAYLOAD,
      });
      const payloadEvent = EventFixture({
        ...event,
        occurrence: {
          type: 1015,
          evidenceData: {offenderSpanIds: ['s1']},
          evidenceDisplay: [],
        },
        entries: [
          {
            type: EntryType.SPANS,
            data: [
              {
                span_id: 's1',
                op: 'http.client',
                description: 'GET /big.json',
                data: {'http.response_content_length': 5_000_000},
              },
            ],
          },
        ],
      });

      const result = formatSpanEvidenceToMarkdown(
        payloadEvent,
        organization,
        payloadGroup
      );
      expect(result).toContain('**Payload Size:**');
      expect(result).toContain('5000000 B');
    });

    it('includes FCP delay for render-blocking asset issues', () => {
      const renderBlockingGroup = GroupFixture({
        issueCategory: IssueCategory.PERFORMANCE,
        issueType: IssueType.PERFORMANCE_RENDER_BLOCKING_ASSET,
      });
      const renderBlockingEvent = EventFixture({
        ...event,
        startTimestamp: 0,
        endTimestamp: 1,
        measurements: {fcp: {value: 1000, unit: 'millisecond'}},
        occurrence: {
          type: 1004,
          evidenceData: {offenderSpanIds: ['s1']},
          evidenceDisplay: [],
        },
        entries: [
          {
            type: EntryType.SPANS,
            data: [
              {
                span_id: 's1',
                op: 'resource.script',
                description: 'app.js',
                start_timestamp: 0,
                timestamp: 0.4,
              },
            ],
          },
        ],
      });

      const result = formatSpanEvidenceToMarkdown(
        renderBlockingEvent,
        organization,
        renderBlockingGroup
      );
      expect(result).toContain('**FCP Delay:**');
      expect(result).toContain('of FCP');
    });

    it('includes query and path parameters for N+1 API call issues', () => {
      const apiGroup = GroupFixture({
        issueCategory: IssueCategory.PERFORMANCE,
        issueType: IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS,
      });
      const apiEvent = EventFixture({
        ...event,
        occurrence: {
          type: 1010,
          evidenceData: {
            offenderSpanIds: ['s1'],
            parameters: ['id:{1,2,3}'],
            pathParameters: ['/users/*'],
          },
          evidenceDisplay: [],
        },
        entries: [
          {
            type: EntryType.SPANS,
            data: [{span_id: 's1', op: 'http.client', description: 'GET /users/1'}],
          },
        ],
      });

      const result = formatSpanEvidenceToMarkdown(apiEvent, organization, apiGroup);
      expect(result).toContain('**Query Parameters:** id:{1,2,3}');
      expect(result).toContain('**Path Parameters:** /users/*');
    });

    it('derives N+1 API query params from spans when evidenceData lacks them', () => {
      const apiGroup = GroupFixture({
        issueCategory: IssueCategory.PERFORMANCE,
        issueType: IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS,
      });
      // No evidenceData.parameters — mirror the UI fallback that derives the
      // changing query params from the offending spans' URLs.
      const spans = [1, 2, 3].map(id => ({
        span_id: `s${id}`,
        op: 'http.client',
        description: `GET https://api.example.com/users?id=${id}`,
      }));
      const apiEvent = EventFixture({
        ...event,
        occurrence: {
          type: 1010,
          evidenceData: {offenderSpanIds: spans.map(s => s.span_id)},
          evidenceDisplay: [],
        },
        entries: [{type: EntryType.SPANS, data: spans}],
      });

      const result = formatSpanEvidenceToMarkdown(apiEvent, organization, apiGroup);
      expect(result).toContain('**Query Parameters:** id:{1,2,3}');
    });

    it('includes vulnerable parameters and request URL for query injection issues', () => {
      const injectionGroup = GroupFixture({
        issueCategory: IssueCategory.PERFORMANCE,
        issueType: IssueType.QUERY_INJECTION_VULNERABILITY,
      });
      const injectionEvent = EventFixture({
        ...event,
        occurrence: {
          type: 1021,
          evidenceData: {
            offenderSpanIds: ['s1'],
            vulnerableParameters: [['username', "admin' OR '1'='1"]],
            requestUrl: 'https://example.com/login',
          },
          evidenceDisplay: [],
        },
        entries: [
          {
            type: EntryType.SPANS,
            data: [
              {
                span_id: 's1',
                op: 'db',
                description: 'SELECT * FROM users WHERE name = ?',
              },
            ],
          },
        ],
      });

      const result = formatSpanEvidenceToMarkdown(
        injectionEvent,
        organization,
        injectionGroup
      );
      expect(result).toContain("**Vulnerable Parameters:** username: admin' OR '1'='1");
      expect(result).toContain('**Request URL:** https://example.com/login');
    });

    it('does not add type-specific metrics for N+1 DB issues', () => {
      // N+1 DB has no extra per-type metric rows beyond the generic summary.
      const result = formatSpanEvidenceToMarkdown(
        nPlusOneEvent,
        organization,
        performanceGroup
      );
      expect(result).not.toContain('**Payload Size:**');
      expect(result).not.toContain('**FCP Delay:**');
      expect(result).not.toContain('**Query Parameters:**');
    });

    it('includes evidence display rows for profiling issues', () => {
      // 2001 is the occurrence type for File I/O on Main Thread
      const profileEvent = EventFixture({
        ...event,
        occurrence: {
          type: 2001,
          evidenceData: {},
          evidenceDisplay: [
            {name: 'Transaction Name', value: 'app.start', important: true},
            {name: 'File Path', value: '/data/cache.db', important: false},
          ],
        },
      });

      expect(formatSpanEvidenceToMarkdown(profileEvent, organization, performanceGroup))
        .toMatchInlineSnapshot(`
        "
        ## Span Evidence

        **Transaction Name:** app.start
        **File Path:** /data/cache.db
        "
      `);
    });

    it('uses evidenceData.transactionName for profiling issues', () => {
      const profileEvent = EventFixture({
        ...event,
        occurrence: {
          type: 2001,
          evidenceData: {transactionName: 'app.start'},
          evidenceDisplay: [
            {name: 'File Path', value: '/data/cache.db', important: false},
          ],
        },
      });

      expect(formatSpanEvidenceToMarkdown(profileEvent, organization, performanceGroup))
        .toMatchInlineSnapshot(`
        "
        ## Span Evidence

        **Transaction:** app.start
        **File Path:** /data/cache.db
        "
      `);
    });

    it('includes regression metrics for endpoint regression issues', () => {
      const regressionEvent = EventFixture({
        ...event,
        title: 'ApiException',
        occurrence: {
          type: 1018,
          evidenceData: {
            transaction: '/api/0/users/',
            aggregateRange1: 100_000,
            aggregateRange2: 200_000,
            trendDifference: 100_000,
            trendPercentage: 2,
            breakpoint: 1_709_161_200,
          },
          evidenceDisplay: [],
        },
      });

      expect(
        formatSpanEvidenceToMarkdown(
          regressionEvent,
          organization,
          endpointRegressionGroup
        )
      ).toMatchInlineSnapshot(`
        "
        ## Regression Summary

        **Endpoint Name:** /api/0/users/
        **Change in Duration:** 2min to 3min (+100%)
        **Approx. Start Time:** Feb 28, 2024 11:00:00 PM UTC
        "
      `);
    });

    it('includes regression metrics for function regression issues', () => {
      const regressionEvent = EventFixture({
        ...event,
        occurrence: {
          type: 2010,
          evidenceData: {
            function: 'processData',
            package: 'com.example.app',
            file: 'MainActivity.kt',
            aggregateRange1: 1_000_000_000,
            aggregateRange2: 2_000_000_000,
            trendDifference: 1_000_000_000,
            trendPercentage: 2,
            breakpoint: 1_709_161_200,
          },
          evidenceDisplay: [],
        },
      });

      expect(
        formatSpanEvidenceToMarkdown(
          regressionEvent,
          organization,
          functionRegressionGroup
        )
      ).toMatchInlineSnapshot(`
        "
        ## Regression Summary

        **Function Name:** processData
        **Package Name:** com.example.app
        **File Name:** MainActivity.kt
        **Change in Duration:** 1s to 2s (+100%)
        **Approx. Start Time:** Feb 28, 2024 11:00:00 PM UTC
        "
      `);
    });

    it('omits span evidence when regression issues lack evidenceData', () => {
      const endpointRegressionEvent = EventFixture({
        ...event,
        title: 'ApiException',
        occurrence: {
          type: 1018,
          evidenceDisplay: [],
        },
      });

      const endpointResult = issueAndEventToMarkdown({
        group: endpointRegressionGroup,
        event: endpointRegressionEvent,
        organization,
      });

      expect(endpointResult).not.toContain('## Span Evidence');
      expect(endpointResult).not.toContain('**Transaction:** ApiException');

      const functionRegressionEvent = EventFixture({
        ...event,
        title: 'ApiException',
        occurrence: {
          type: 2010,
          evidenceDisplay: [],
        },
      });

      const functionResult = issueAndEventToMarkdown({
        group: functionRegressionGroup,
        event: functionRegressionEvent,
        organization,
      });

      expect(functionResult).not.toContain('## Span Evidence');
      expect(functionResult).not.toContain('**Transaction:** ApiException');
    });

    it('does not include span evidence for non-performance issues', () => {
      const result = issueAndEventToMarkdown({group, event, organization});

      expect(result).not.toContain('## Span Evidence');
    });
  });

  describe('useCopyIssueDetails', () => {
    const mockCopy = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();

      mockCopy.mockResolvedValue('');

      jest.mocked(copyToClipboardModule.useCopyToClipboard).mockReturnValue({
        copy: mockCopy,
      });

      jest.spyOn(explorerAutofixHooks, 'useExplorerAutofix').mockReturnValue({
        runState: mockAutofixData,
        isLoading: false,
        isPolling: false,
        startStep: jest.fn(),
        createPR: jest.fn(),
        reset: jest.fn(),
        triggerCodingAgentHandoff: jest.fn(),
        codingAgentErrors: [],
        dismissCodingAgentError: jest.fn(),
      } as any);

      jest.spyOn(indicators, 'addSuccessMessage').mockImplementation(() => {});
      jest.spyOn(indicators, 'addErrorMessage').mockImplementation(() => {});
      jest.spyOn(useOrganization, 'useOrganization').mockReturnValue(organization);
    });

    it('calls useCopyToClipboard hook', () => {
      renderHook(() => useCopyIssueDetails(group, event));

      // Check that the hook was called
      expect(copyToClipboardModule.useCopyToClipboard).toHaveBeenCalled();
    });

    it('sets up hotkeys with the correct callbacks', () => {
      const useHotkeysMock = jest.spyOn(
        require('@sentry/scraps/hotkey/useHotkeys'),
        'useHotkeys'
      );

      renderHook(() => useCopyIssueDetails(group, event));

      expect(useHotkeysMock).toHaveBeenCalledWith([
        {
          match: 'mod+alt+c',
          callback: expect.any(Function),
          skipPreventDefault: expect.any(Boolean),
        },
      ]);
    });

    it('provides partial data when event is undefined', async () => {
      let capturedText = '';

      mockCopy.mockImplementation((text: string) => {
        capturedText = text;
        return Promise.resolve(text);
      });

      renderHook(() => useCopyIssueDetails(group, undefined));

      await userEvent.keyboard('{Control>}{Alt>}c{/Alt}{/Control}');

      expect(capturedText).toContain(`# ${group.title}`);
      expect(capturedText).toContain(`**Issue ID:** ${group.id}`);
      expect(capturedText).toContain(`**Project:** ${group.project?.slug}`);
      expect(capturedText).toContain('## Root Cause');
      expect(capturedText).toContain('## Plan');
      expect(capturedText).not.toContain('## Exception');
    });

    it('generates markdown with the correct data when event is provided', async () => {
      let capturedText = '';

      mockCopy.mockImplementation((text: string) => {
        capturedText = text;
        return Promise.resolve(text);
      });

      renderHook(() => useCopyIssueDetails(group, event));

      await userEvent.keyboard('{Control>}{Alt>}c{/Alt}{/Control}');

      expect(capturedText).toContain(`# ${group.title}`);
      expect(capturedText).toContain(`**Issue ID:** ${group.id}`);
    });
  });
});
