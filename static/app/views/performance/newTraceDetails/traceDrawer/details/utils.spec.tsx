import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  getAttributeFilterSearch,
  getSearchInExploreTarget,
  getTraceAttributesTreeActions,
  getTraceKeyValueActions,
  getTraceIssueSeverityClassName,
  parseJsonWithFix,
  TraceDrawerActionKind,
  TraceDrawerActionValueKind,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {
  makeEAPError,
  makeEAPOccurrence,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

describe('getAttributeFilterSearch', () => {
  it('formats an attribute key and value as a search filter', () => {
    expect(getAttributeFilterSearch('http.request.method', 'GET')).toBe(
      'http.request.method:GET'
    );
  });

  it('quotes attribute values that need query escaping', () => {
    expect(getAttributeFilterSearch('span.description', 'GET /api/users')).toBe(
      'span.description:"GET /api/users"'
    );
  });

  it('quotes JSON array attribute values as a single literal', () => {
    expect(
      getAttributeFilterSearch(
        'gen_ai.system_instructions',
        '[{"type": "text", "content": "hello"}]'
      )
    ).toBe(
      'gen_ai.system_instructions:"[{\\"type\\": \\"text\\", \\"content\\": \\"hello\\"}]"'
    );
  });
});

const organization = OrganizationFixture({slug: 'org-slug'});
const location = LocationFixture({query: {statsPeriod: '14d'}});

describe('getSearchInExploreTarget', () => {
  it('quotes JSON array values as a single literal in the generated explore query', () => {
    const target = getSearchInExploreTarget(
      organization,
      location,
      '1',
      'gen_ai.system_instructions',
      '[{"type": "text", "content": "hello"}]',
      TraceDrawerActionKind.INCLUDE
    );

    expect(target.query.query).toBe(
      'gen_ai.system_instructions:"[{\\"type\\": \\"text\\", \\"content\\": \\"hello\\"}]"'
    );
  });

  it('escapes already escaped quotes in JSON string values for the query layer', () => {
    const target = getSearchInExploreTarget(
      organization,
      location,
      '1',
      'gen_ai.system_instructions',
      '[{"type": "text", "content": "say \\"backend\\""}]',
      TraceDrawerActionKind.INCLUDE
    );

    expect(target.query.query).toBe(
      'gen_ai.system_instructions:"[{\\"type\\": \\"text\\", \\"content\\": \\"say \\\\"backend\\\\"\\"}]"'
    );
  });

  it('quotes values that are already wrapped in quotes as a single literal', () => {
    const target = getSearchInExploreTarget(
      organization,
      location,
      '1',
      'span.description',
      '"hello"',
      TraceDrawerActionKind.INCLUDE
    );

    expect(target.query.query).toBe('span.description:"\\"hello\\""');
  });

  it('handles null values', () => {
    const target = getSearchInExploreTarget(
      organization,
      location,
      '1',
      'app.device',
      null,
      TraceDrawerActionKind.INCLUDE
    );

    expect(target.query.query).toBe('app.device:""');
  });
});

describe('getTraceAttributesTreeActions', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue('')},
    });
  });

  it('copies the attribute as a formatted filter', () => {
    const actions = getTraceAttributesTreeActions({
      location: LocationFixture(),
      organization: OrganizationFixture({features: []}),
    })({
      subtree: {},
      value: 'GET /api/users',
      originalAttribute: {
        attribute_key: 'description',
        attribute_value: 'GET /api/users',
        original_attribute_key: 'span.description',
      },
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.label).toBe('Copy attribute for filter');

    actions[0]?.onAction?.();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'span.description:"GET /api/users"'
    );
  });
});

describe('getTraceKeyValueActions', () => {
  it('adds a copy-filter action for attribute values', () => {
    const actions = getTraceKeyValueActions({
      location: LocationFixture(),
      organization: OrganizationFixture({features: []}),
      rowKey: 'span.description',
      rowValue: 'GET /api/users',
      kind: TraceDrawerActionValueKind.ATTRIBUTE,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.label).toBe('Copy attribute for filter');
  });
});

describe('parseJsonWithFix', () => {
  it('parses valid JSON without fixing', () => {
    const data = '{"name":"test","value":123}';
    const result = parseJsonWithFix(data);

    expect(result.fixedInvalidJson).toBe(false);
    expect(result.parsed).toEqual({name: 'test', value: 123});
  });

  it('fixes JSON truncated due to size limits mid-string', () => {
    const data = '{"message":"This is a very long message that got cut off du';
    const result = parseJsonWithFix(data);

    expect(result.fixedInvalidJson).toBe(true);
    expect(result.parsed).toEqual({
      message: 'This is a very long message that got cut off du~~',
    });
  });

  it('fixes JSON truncated due to size limits mid-array', () => {
    const data = '{"items":["item1","item2","item3","this is a very long ite';
    const result = parseJsonWithFix(data);

    expect(result.fixedInvalidJson).toBe(true);
    expect(result.parsed).toEqual({
      items: ['item1', 'item2', 'item3', 'this is a very long ite~~'],
    });
  });

  it('fixes truncations with ... marker', () => {
    const data =
      '[{"role":"user","content":"What is the capital?"},{"role":"assistant","content":"Paris is the capital of France. With an estimated population of 2,102,650 residents as of 1 January 2023...';
    const result = parseJsonWithFix(data);

    expect(result.fixedInvalidJson).toBe(true);
    expect(result.parsed).toEqual([
      {role: 'user', content: 'What is the capital?'},
      {
        role: 'assistant',
        content:
          'Paris is the capital of France. With an estimated population of 2,102,650 residents as of 1 January 2023...~~',
      },
    ]);
  });

  it('handles JSON with [Filtered] from PII data scrubbing without throwing', () => {
    const data = '[Filtered]';
    const result = parseJsonWithFix(data);
    expect(result.fixedInvalidJson).toBe(true);
    expect(result.parsed).toBeNull();
  });

  it('handles JSON array containing [Filtered] values without throwing', () => {
    const data = '[{"role":"user","content":[Filtered]}]';
    const result = parseJsonWithFix(data);
    expect(result.fixedInvalidJson).toBe(true);
    expect(result.parsed).toBeNull();
  });

  it('parses valid JSON that contains "[Filtered]" as a quoted string value', () => {
    const data = '[{"role":"user","content":"The [Filtered] tag was applied"}]';
    const result = parseJsonWithFix(data);
    expect(result.fixedInvalidJson).toBe(false);
    expect(result.parsed).toEqual([
      {role: 'user', content: 'The [Filtered] tag was applied'},
    ]);
  });

  it('handles JSON with bad escape sequences without throwing', () => {
    const data = '{"message":"bad escape \\p sequence"}';
    const result = parseJsonWithFix(data);
    expect(result.fixedInvalidJson).toBe(true);
    expect(result.parsed).toBeNull();
  });
});

describe('getTraceIssueSeverityClassName', () => {
  it('returns the level for error event_type', () => {
    const issue = makeEAPError({level: 'warning'});
    expect(getTraceIssueSeverityClassName(issue)).toBe('warning');
  });

  it('returns occurrence for non-error issues with non-error/fatal levels', () => {
    const issue = makeEAPOccurrence({level: 'warning'});
    expect(getTraceIssueSeverityClassName(issue)).toBe('occurrence');
  });

  it('treats undefined event_type as non-error (warning -> occurrence)', () => {
    const issue = {level: 'warning', event_type: undefined} as TraceTree.TraceIssue;
    expect(getTraceIssueSeverityClassName(issue)).toBe('occurrence');
  });

  it('treats undefined event_type as non-error (error -> error)', () => {
    const issue = {level: 'error', event_type: undefined} as TraceTree.TraceIssue;
    expect(getTraceIssueSeverityClassName(issue)).toBe('error');
  });

  it('returns fatal for occurrence issues with fatal level', () => {
    const issue = makeEAPOccurrence({level: 'fatal'});
    expect(getTraceIssueSeverityClassName(issue)).toBe('fatal');
  });

  it('returns occurrence for occurrence issues with info level', () => {
    const issue = makeEAPOccurrence({level: 'info'});
    expect(getTraceIssueSeverityClassName(issue)).toBe('occurrence');
  });
});
