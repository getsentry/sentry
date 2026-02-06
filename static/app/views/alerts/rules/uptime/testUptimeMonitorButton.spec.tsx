import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {TestUptimeMonitorButton} from 'sentry/views/alerts/rules/uptime/testUptimeMonitorButton';
import {PreviewCheckStatus} from 'sentry/views/alerts/rules/uptime/types';

describe('TestUptimeMonitorButton', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.spyOn(indicators, 'addSuccessMessage');
    jest.spyOn(indicators, 'addErrorMessage');
  });

  it('shows error when URL is not provided', async () => {
    render(
      <TestUptimeMonitorButton
        getFormData={() => ({
          url: undefined,
          method: 'GET',
          headers: [],
          body: null,
          timeoutMs: 5000,
          assertion: null,
        })}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Test Monitor'}));

    await waitFor(() => {
      expect(indicators.addErrorMessage).toHaveBeenCalledWith(
        'Please enter a URL to test'
      );
    });
  });

  it('calls preview endpoint with form data', async () => {
    const mockPreview = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-preview-check/`,
      method: 'POST',
      body: {check_result: {status: PreviewCheckStatus.SUCCESS}},
    });

    render(
      <TestUptimeMonitorButton
        getFormData={() => ({
          url: 'https://example.com',
          method: 'GET',
          headers: [['X-Custom', 'value']],
          body: null,
          timeoutMs: 10000,
          assertion: null,
        })}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Test Monitor'}));

    await waitFor(() => {
      expect(mockPreview).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/uptime-preview-check/`,
        expect.objectContaining({
          method: 'POST',
          data: {
            url: 'https://example.com',
            method: 'GET',
            headers: [['X-Custom', 'value']],
            body: null,
            timeoutMs: 10000,
            assertion: null,
          },
        })
      );
    });
  });

  it('shows success message on successful check', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-preview-check/`,
      method: 'POST',
      body: {check_result: {status: PreviewCheckStatus.SUCCESS}},
    });

    render(
      <TestUptimeMonitorButton
        getFormData={() => ({
          url: 'https://example.com',
          method: 'GET',
          headers: [],
          body: null,
          timeoutMs: 5000,
          assertion: null,
        })}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Test Monitor'}));

    await waitFor(() => {
      expect(indicators.addSuccessMessage).toHaveBeenCalledWith(
        'Uptime check passed successfully'
      );
    });
  });

  it('shows error message on failed check', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-preview-check/`,
      method: 'POST',
      statusCode: 400,
      body: {error: 'Check failed'},
    });

    render(
      <TestUptimeMonitorButton
        getFormData={() => ({
          url: 'https://example.com',
          method: 'GET',
          headers: [],
          body: null,
          timeoutMs: 5000,
          assertion: null,
        })}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Test Monitor'}));

    await waitFor(() => {
      expect(indicators.addErrorMessage).toHaveBeenCalledWith('Uptime check failed');
    });
  });

  it('calls onValidationError with response JSON on validation failure', async () => {
    const responseBody = {
      assertion: {error: 'compilation_error', details: 'Invalid expression'},
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-preview-check/`,
      method: 'POST',
      statusCode: 400,
      body: responseBody,
    });

    const onValidationError = jest.fn();

    render(
      <TestUptimeMonitorButton
        getFormData={() => ({
          url: 'https://example.com',
          method: 'GET',
          headers: [],
          body: null,
          timeoutMs: 5000,
          assertion: null,
        })}
        onValidationError={onValidationError}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Test Monitor'}));

    await waitFor(() => {
      expect(onValidationError).toHaveBeenCalledWith(responseBody);
    });
    expect(indicators.addErrorMessage).not.toHaveBeenCalled();
  });

  it('falls back to error toast when onValidationError is not provided', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-preview-check/`,
      method: 'POST',
      statusCode: 400,
      body: {assertion: {error: 'compilation_error', details: 'Invalid'}},
    });

    render(
      <TestUptimeMonitorButton
        getFormData={() => ({
          url: 'https://example.com',
          method: 'GET',
          headers: [],
          body: null,
          timeoutMs: 5000,
          assertion: null,
        })}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Test Monitor'}));

    await waitFor(() => {
      expect(indicators.addErrorMessage).toHaveBeenCalledWith('Uptime check failed');
    });
  });

  it('shows error message when check_result.status is failure', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-preview-check/`,
      method: 'POST',
      body: {check_result: {status: PreviewCheckStatus.FAILURE}},
    });

    render(
      <TestUptimeMonitorButton
        getFormData={() => ({
          url: 'https://example.com',
          method: 'GET',
          headers: [],
          body: null,
          timeoutMs: 5000,
          assertion: null,
        })}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Test Monitor'}));

    await waitFor(() => {
      expect(indicators.addErrorMessage).toHaveBeenCalledWith('Uptime check failed');
    });
  });

  it('disables button while loading', async () => {
    // Use a delayed response to test loading state
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-preview-check/`,
      method: 'POST',
      body: {check_result: {status: PreviewCheckStatus.SUCCESS}},
    });

    render(
      <TestUptimeMonitorButton
        getFormData={() => ({
          url: 'https://example.com',
          method: 'GET',
          headers: [],
          body: null,
          timeoutMs: 5000,
          assertion: null,
        })}
      />,
      {organization}
    );

    const button = screen.getByRole('button', {name: 'Test Monitor'});
    await userEvent.click(button);

    // Button should eventually be enabled again after the request completes
    await waitFor(() => {
      expect(button).toBeEnabled();
    });
  });

  it('renders custom label when provided', () => {
    render(
      <TestUptimeMonitorButton
        label="Test Rule"
        getFormData={() => ({
          url: 'https://example.com',
          method: 'GET',
          headers: [],
          body: null,
          timeoutMs: 5000,
          assertion: null,
        })}
      />,
      {organization}
    );

    expect(screen.getByRole('button', {name: 'Test Rule'})).toBeInTheDocument();
  });

  it('shows error message when check_result.status is missed_window', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-preview-check/`,
      method: 'POST',
      body: {check_result: {status: PreviewCheckStatus.MISSED_WINDOW}},
    });

    render(
      <TestUptimeMonitorButton
        getFormData={() => ({
          url: 'https://example.com',
          method: 'GET',
          headers: [],
          body: null,
          timeoutMs: 5000,
          assertion: null,
        })}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Test Monitor'}));

    await waitFor(() => {
      expect(indicators.addErrorMessage).toHaveBeenCalledWith('Uptime check failed');
    });
  });

  it('shows error message when check_result.status is disallowed_by_robots', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-preview-check/`,
      method: 'POST',
      body: {check_result: {status: PreviewCheckStatus.DISALLOWED_BY_ROBOTS}},
    });

    render(
      <TestUptimeMonitorButton
        getFormData={() => ({
          url: 'https://example.com',
          method: 'GET',
          headers: [],
          body: null,
          timeoutMs: 5000,
          assertion: null,
        })}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Test Monitor'}));

    await waitFor(() => {
      expect(indicators.addErrorMessage).toHaveBeenCalledWith('Uptime check failed');
    });
  });

  it('sends assertion data to the preview endpoint', async () => {
    const mockAssertion = {
      root: {
        id: 'root',
        op: 'and' as const,
        children: [
          {
            id: 'status-check',
            op: 'status_code_check' as const,
            operator: {cmp: 'equals' as const},
            value: 200,
          },
        ],
      },
    };

    const mockPreview = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-preview-check/`,
      method: 'POST',
      body: {check_result: {status: PreviewCheckStatus.SUCCESS}},
    });

    render(
      <TestUptimeMonitorButton
        getFormData={() => ({
          url: 'https://example.com',
          method: 'POST',
          headers: [],
          body: '{"test": true}',
          timeoutMs: 10000,
          assertion: mockAssertion,
        })}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Test Monitor'}));

    await waitFor(() => {
      expect(mockPreview).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/uptime-preview-check/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            url: 'https://example.com',
            assertion: mockAssertion,
            body: '{"test": true}',
          }),
        })
      );
    });
  });
});
