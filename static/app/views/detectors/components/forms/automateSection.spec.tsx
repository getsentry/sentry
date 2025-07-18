import {AutomationFixture} from 'sentry-fixture/automations';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/forms/form';

import {AutomateSection} from './automateSection';

describe('AutomateSection', function () {
  const automation1 = AutomationFixture();

  beforeEach(() => {
    jest.resetAllMocks();
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'GET',
      match: [MockApiClient.matchQuery({ids: [automation1.id]})],
      body: [automation1],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      method: 'GET',
      body: [automation1],
    });
  });

  it('can connect an existing automation', async function () {
    render(
      <Form>
        <AutomateSection />
      </Form>
    );

    expect(screen.getByText('Automate')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Connect an Automation'));

    const drawer = await screen.findByRole('complementary', {
      name: 'Connect Automations',
    });

    await within(drawer).findByText(automation1.name);

    const connectedAutomationsList = await screen.findByTestId(
      'drawer-connected-automations-list'
    );
    const allAutomationsList = await screen.findByTestId('drawer-all-automations-list');

    expect(within(allAutomationsList).getByText(automation1.name)).toBeInTheDocument();

    // Clicking connect should add the automation to the connected list
    await userEvent.click(within(drawer).getByRole('button', {name: 'Connect'}));
    await waitFor(() => {
      expect(
        within(connectedAutomationsList).getByText(automation1.name)
      ).toBeInTheDocument();
    });
  });

  it('can disconnect an existing automation', async function () {
    render(
      <Form initialData={{workflowIds: [automation1.id]}}>
        <AutomateSection />
      </Form>
    );

    // Should display automation as connected
    expect(screen.getByText('Connected Automations')).toBeInTheDocument();
    expect(await screen.findByText(automation1.name)).toBeInTheDocument();

    await userEvent.click(screen.getByText('Edit Automations'));
    const drawer = await screen.findByRole('complementary', {
      name: 'Connect Automations',
    });

    const connectedAutomationsList = await screen.findByTestId(
      'drawer-connected-automations-list'
    );
    expect(
      within(connectedAutomationsList).getByText(automation1.name)
    ).toBeInTheDocument();

    // Clicking disconnect should remove the automation from the connected list
    await userEvent.click(
      within(drawer).getAllByRole('button', {name: 'Disconnect'})[0]!
    );
    await waitFor(() => {
      expect(
        within(connectedAutomationsList).queryByText(automation1.name)
      ).not.toBeInTheDocument();
    });
  });
});
