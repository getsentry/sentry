import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {AssertionSuggestionsDrawerContent} from 'sentry/views/alerts/rules/uptime/assertionSuggestionsDrawerContent';
import {
  AssertionType,
  ComparisonType,
  OpType,
  type PreviewCheckPayload,
} from 'sentry/views/alerts/rules/uptime/types';

describe('AssertionSuggestionsDrawerContent', () => {
  const organization = OrganizationFixture();

  const defaultPayload: PreviewCheckPayload = {
    url: 'https://example.com/api/health',
    timeoutMs: 5000,
    method: 'GET',
    headers: [],
    body: null,
  };

  const mockSuggestionsResponse = {
    preview_result: {
      check_result: {
        actual_check_time_ms: 1000,
        duration_ms: 150,
        guid: 'test-guid',
        region: 'us',
        scheduled_check_time_ms: 1000,
        span_id: 'test-span',
        status: 'success',
        status_reason: null,
        subscription_id: 'test-sub',
        trace_id: 'test-trace',
        request_info: {
          http_status_code: 200,
          request_type: 'GET',
          url: 'https://example.com/api/health',
          response_body: btoa('{"status":"ok"}'),
          response_headers: [['content-type', 'application/json']],
        },
      },
    },
    suggested_assertion: null,
    suggestions: [
      {
        assertion_type: AssertionType.STATUS_CODE,
        comparison: ComparisonType.EQUALS,
        expected_value: '200',
        confidence: 0.95,
        explanation: 'HTTP 200 indicates a successful response',
        json_path: null,
        header_name: null,
        assertion_json: {
          op: OpType.STATUS_CODE_CHECK,
          id: 'sug-1',
          operator: {cmp: ComparisonType.EQUALS},
          value: 200,
        },
      },
      {
        assertion_type: AssertionType.JSON_PATH,
        comparison: ComparisonType.EQUALS,
        expected_value: 'ok',
        confidence: 0.8,
        explanation: 'The status field should be ok',
        json_path: '$.status',
        header_name: null,
        assertion_json: {
          op: OpType.JSON_PATH,
          id: 'sug-2',
          value: '$.status',
          operator: {cmp: ComparisonType.EQUALS},
          operand: {jsonpath_op: 'literal', value: 'ok'},
        },
      },
    ],
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows skeleton placeholders while loading', () => {
    // Add mock with a large asyncDelay so the request stays pending
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-assertion-suggestions/`,
      method: 'POST',
      body: mockSuggestionsResponse,
      asyncDelay: 100000,
    });

    render(
      <AssertionSuggestionsDrawerContent payload={defaultPayload} onApply={jest.fn()} />,
      {organization}
    );

    expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(6);
  });

  it('renders suggestion cards after successful fetch', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-assertion-suggestions/`,
      method: 'POST',
      body: mockSuggestionsResponse,
    });

    render(
      <AssertionSuggestionsDrawerContent payload={defaultPayload} onApply={jest.fn()} />,
      {organization}
    );

    await waitFor(() => {
      expect(screen.getByText(/Status code/)).toBeInTheDocument();
    });

    expect(screen.getByText(/\$\.status/)).toBeInTheDocument();
    expect(screen.getByText(/95% confidence/)).toBeInTheDocument();
    expect(screen.getByText(/80% confidence/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: 'Apply'})).toHaveLength(2);
  });

  it('shows error message inline on fetch failure', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-assertion-suggestions/`,
      method: 'POST',
      statusCode: 500,
      body: {},
    });

    render(
      <AssertionSuggestionsDrawerContent payload={defaultPayload} onApply={jest.fn()} />,
      {organization}
    );

    expect(
      await screen.findByText(/Failed to generate assertion suggestions/)
    ).toBeInTheDocument();
  });

  it('renders drawer header with title', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-assertion-suggestions/`,
      method: 'POST',
      body: mockSuggestionsResponse,
    });

    render(
      <AssertionSuggestionsDrawerContent payload={defaultPayload} onApply={jest.fn()} />,
      {organization}
    );

    expect(screen.getByText('AI Assertion Suggestions')).toBeInTheDocument();
  });

  it('renders info alert about AI-generated suggestions', () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-assertion-suggestions/`,
      method: 'POST',
      body: mockSuggestionsResponse,
    });

    render(
      <AssertionSuggestionsDrawerContent payload={defaultPayload} onApply={jest.fn()} />,
      {organization}
    );

    expect(
      screen.getByText(
        'These suggestions are generated by AI based on the HTTP response. Review each suggestion before applying.'
      )
    ).toBeInTheDocument();
  });
});
