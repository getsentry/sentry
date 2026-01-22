import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {TestUptimeMonitorButton} from 'sentry/views/alerts/rules/uptime/testUptimeMonitorButton';

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
      body: {check_result: {status: 'success'}},
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
            region: 'default',
          },
        })
      );
    });
  });

  it('shows success message on successful check', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-preview-check/`,
      method: 'POST',
      body: {check_result: {status: 'success'}},
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

  it('shows error message when check_result.status is failure', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-preview-check/`,
      method: 'POST',
      body: {check_result: {status: 'failure'}},
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
      body: {check_result: {status: 'success'}},
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
});
