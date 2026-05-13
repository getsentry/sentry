import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SeerWorkflowsConfigure from 'sentry/views/seerWorkflows/configure';
import {STRATEGY_META} from 'sentry/views/seerWorkflows/strategies';
import type {WorkflowKind} from 'sentry/views/seerWorkflows/types';

const CONFIGURABLE_KINDS = (Object.keys(STRATEGY_META) as WorkflowKind[]).filter(
  kind => STRATEGY_META[kind].visibility === 'configurable'
);

describe('SeerWorkflowsConfigure', () => {
  const organization = OrganizationFixture();

  it('renders every configurable strategy as a card by default', async () => {
    render(<SeerWorkflowsConfigure />, {organization});

    expect(
      await screen.findByRole('heading', {name: 'Configure Sentry Workflows'})
    ).toBeInTheDocument();

    for (const kind of CONFIGURABLE_KINDS) {
      expect(
        screen.getByRole('link', {name: STRATEGY_META[kind].label})
      ).toBeInTheDocument();
    }
  });

  it('starts every strategy disabled when no mocks are loaded', async () => {
    render(<SeerWorkflowsConfigure />, {organization});

    const disabledTriggers = await screen.findAllByRole('button', {name: /Disabled/});
    expect(disabledTriggers).toHaveLength(CONFIGURABLE_KINDS.length);
  });

  it('renders a "View runs" link back to the history page', async () => {
    render(<SeerWorkflowsConfigure />, {organization});

    const link = await screen.findByRole('button', {name: /View runs/});
    expect(link).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/autofix/`
    );
  });

  it('seeds enabled cadences from mocks when ?mock=1 is set', async () => {
    render(<SeerWorkflowsConfigure />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/autofix/configure/',
          query: {mock: '1'},
        },
      },
    });

    // Mock-enabled strategies expose their frequency on the trigger button.
    expect(await screen.findByRole('button', {name: 'Hourly'})).toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: 'Daily'}).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', {name: 'Weekly'}).length).toBeGreaterThan(0);
    // Cards are still grouped under category sub-headers.
    expect(screen.getByText('Issues')).toBeInTheDocument();
    expect(screen.getByText('Reliability')).toBeInTheDocument();
    expect(screen.getByText('User experience')).toBeInTheDocument();
  });

  it('toggles the ?mock=1 query param via the MockToggle button', async () => {
    const {router} = render(<SeerWorkflowsConfigure />, {organization});

    const toggle = await screen.findByRole('button', {name: 'Mocks: Off'});
    expect(router.location.query.mock).toBeUndefined();

    await userEvent.click(toggle);
    expect(router.location.query.mock).toBe('1');
    expect(await screen.findByRole('button', {name: 'Mocks: On'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Mocks: On'}));
    expect(router.location.query.mock).toBeUndefined();
  });

  it('enables a strategy when a frequency is picked from its selector', async () => {
    render(<SeerWorkflowsConfigure />, {organization});

    const disabledTriggers = await screen.findAllByRole('button', {name: /Disabled/});
    expect(disabledTriggers).toHaveLength(CONFIGURABLE_KINDS.length);

    await userEvent.click(disabledTriggers[0]!);
    await userEvent.click(await screen.findByRole('option', {name: 'Daily'}));

    expect(screen.getByRole('button', {name: 'Daily'})).toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: /Disabled/})).toHaveLength(
      CONFIGURABLE_KINDS.length - 1
    );
  });

  it('disables a mock-enabled strategy when Disabled is picked', async () => {
    render(<SeerWorkflowsConfigure />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/autofix/configure/',
          query: {mock: '1'},
        },
      },
    });

    // feedback_summary is the only mock-enabled strategy at Hourly cadence.
    const hourlyTrigger = await screen.findByRole('button', {name: 'Hourly'});
    await userEvent.click(hourlyTrigger);
    await userEvent.click(await screen.findByRole('option', {name: 'Disabled'}));

    expect(screen.queryByRole('button', {name: 'Hourly'})).not.toBeInTheDocument();
  });
});
