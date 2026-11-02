import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {AgentSelector} from 'sentry/views/insights/common/components/agentSelector';

const AGENTS = ['Alpha', 'Bravo', 'Charlie', 'Delta'];

function renderSelector(query: Record<string, string | string[]> = {}) {
  return render(<AgentSelector referrer="test" />, {
    initialRouterConfig: {location: {pathname: '/', query}},
  });
}

async function openMenu() {
  await userEvent.click(await screen.findByRole('button', {name: /Agent/}));
  await screen.findByRole('row', {name: 'Alpha'});
}

describe('AgentSelector', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: AGENTS.map(name => ({
          'gen_ai.agent.name': name,
          'gen_ai.function_id': '',
          'count()': 1,
        })),
        meta: {fields: {}, units: {}},
      },
    });
  });

  it('selects a single agent on a plain click', async () => {
    const {router} = renderSelector();
    await openMenu();

    await userEvent.click(screen.getByRole('row', {name: 'Bravo'}));

    await waitFor(() => expect(router.location.query.agent).toBe('Bravo'));
  });

  it('stages multiple agents via checkboxes and applies them', async () => {
    const {router} = renderSelector();
    await openMenu();

    await userEvent.click(screen.getByRole('checkbox', {name: 'Select Alpha'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Select Charlie'}));
    expect(router.location.query.agent).toBeUndefined();

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    await waitFor(() => expect(router.location.query.agent).toBe('Alpha,Charlie'));
  });

  it('selects a range with shift+click', async () => {
    const {router} = renderSelector();
    await openMenu();

    await userEvent.click(screen.getByRole('checkbox', {name: 'Select Alpha'}));
    await userEvent.keyboard('{Shift>}');
    await userEvent.click(screen.getByRole('row', {name: 'Charlie'}));
    await userEvent.keyboard('{/Shift}');

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    await waitFor(() => expect(router.location.query.agent).toBe('Alpha,Bravo,Charlie'));
  });

  it('clears the filter with the All Agents checkbox', async () => {
    const {router} = renderSelector({agent: 'Alpha,Bravo'});
    await openMenu();

    const allAgents = screen.getByRole('checkbox', {
      name: 'Select All Agents',
    });
    expect(allAgents).not.toBeChecked();

    await userEvent.click(allAgents);
    expect(allAgents).toBeChecked();

    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));

    await waitFor(() => expect(router.location.query.agent).toBeUndefined());
  });

  it('clears the filter with the Reset button', async () => {
    const {router} = renderSelector({agent: 'Alpha'});
    await openMenu();

    await userEvent.click(screen.getByRole('button', {name: 'Reset'}));

    await waitFor(() => expect(router.location.query.agent).toBeUndefined());
  });

  it('does not touch the URL when the menu is dismissed without changes', async () => {
    const {router} = renderSelector({agent: 'Alpha', tableCursor: 'abc'});
    await openMenu();

    await userEvent.click(document.body);

    expect(router.location.query.tableCursor).toBe('abc');
    expect(router.location.query.agent).toBe('Alpha');
  });

  it('keeps the committed label on the trigger while changes are staged', async () => {
    renderSelector({agent: 'Alpha,Bravo'});
    await openMenu();

    await userEvent.click(screen.getByRole('checkbox', {name: 'Select All Agents'}));

    const trigger = screen.getByRole('button', {name: /Agent/, expanded: true});
    expect(trigger).toHaveTextContent('Alpha');
    expect(trigger).toHaveTextContent('+1');
  });
});
