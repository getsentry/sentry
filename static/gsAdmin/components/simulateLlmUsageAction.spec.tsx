import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {closeModal} from '@sentry/scraps/modal';

import {triggerSimulateLlmUsageModal} from 'admin/components/simulateLlmUsageAction';

describe('SimulateLlmUsageAction', () => {
  const onSuccess = jest.fn();
  const organization = OrganizationFixture();
  const project = ProjectFixture({id: '42', slug: 'backend'});
  const url = `/_admin/customers/${organization.slug}/simulated-llm-usage/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    closeModal();
    onSuccess.mockClear();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [project],
    });
  });

  async function fillRequiredFields() {
    await userEvent.click(await screen.findByRole('textbox', {name: 'Project'}));
    await userEvent.click(screen.getByText('backend'));
    await userEvent.type(screen.getByRole('spinbutton', {name: 'Cost'}), '12.5');
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Notes'}),
      'testing invoicing'
    );
  }

  it('posts the simulated usage', async () => {
    const simulateMock = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      statusCode: 201,
      body: {litellmCallId: 'abc', timestamp: '2026-03-09T23:30:15.123456Z'},
    });

    triggerSimulateLlmUsageModal({orgId: organization.slug, onSuccess});
    const {waitForModalToHide} = renderGlobalModal();

    await fillRequiredFields();
    await userEvent.click(screen.getByRole('button', {name: 'Record Usage'}));

    await waitForModalToHide();
    expect(simulateMock).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        method: 'POST',
        data: {
          feature: 'test_paid',
          projectId: 42,
          costUsd: 12.5,
          ticketUrl: '',
          notes: 'testing invoicing',
        },
      })
    );
    expect(onSuccess).toHaveBeenCalled();
  });

  it('requires notes', async () => {
    const simulateMock = MockApiClient.addMockResponse({url, method: 'POST'});

    triggerSimulateLlmUsageModal({orgId: organization.slug, onSuccess});
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('textbox', {name: 'Project'}));
    await userEvent.click(screen.getByText('backend'));
    await userEvent.type(screen.getByRole('spinbutton', {name: 'Cost'}), '1');
    await userEvent.click(screen.getByRole('button', {name: 'Record Usage'}));

    expect(
      await screen.findByText('Explain why you are simulating usage')
    ).toBeInTheDocument();
    expect(simulateMock).not.toHaveBeenCalled();
  });

  it('shows field errors from the endpoint', async () => {
    MockApiClient.addMockResponse({
      url,
      method: 'POST',
      statusCode: 400,
      body: {costUsd: ['Must be at most 100.0.']},
    });

    triggerSimulateLlmUsageModal({orgId: organization.slug, onSuccess});
    renderGlobalModal();

    await fillRequiredFields();
    await userEvent.click(screen.getByRole('button', {name: 'Record Usage'}));

    expect(await screen.findByText('Must be at most 100.0.')).toBeInTheDocument();
    await waitFor(() => expect(onSuccess).not.toHaveBeenCalled());
  });
});
