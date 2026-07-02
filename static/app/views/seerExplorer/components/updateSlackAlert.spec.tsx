import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {UpdateSlackAlert} from 'sentry/views/seerExplorer/components/updateSlackAlert';

describe('UpdateSlackAlert', () => {
  const organization = OrganizationFixture({slug: 'org-slug'});

  afterEach(() => {
    // sessionStorage persists across tests in jsdom; reset between cases so the
    // dismissed flag from one test doesn't leak into the next.
    window.sessionStorage.clear();
  });

  it('renders the nudge message and update link', () => {
    render(<UpdateSlackAlert num_configurations={2} />, {organization});

    expect(
      screen.getByText(
        'Chat, ask questions, and debug with Sentry in the new Slack app. Please reinstall the slack app to get started.'
      )
    ).toBeInTheDocument();

    const link = screen.getByRole('button', {name: 'Update Now'});
    expect(link).toHaveAttribute(
      'href',
      '/settings/org-slug/integrations/slack/?tab=configurations&referrer=seer_explorer_update_slack'
    );
  });

  it('auto-opens the reinstall modal when there is exactly one workspace', () => {
    render(<UpdateSlackAlert num_configurations={1} />, {organization});

    expect(screen.getByRole('button', {name: 'Update Now'})).toHaveAttribute(
      'href',
      '/settings/org-slug/integrations/slack/?tab=configurations&referrer=seer_explorer_update_slack&showInstallModal=1'
    );
  });

  it('hides the alert when dismissed', async () => {
    render(<UpdateSlackAlert num_configurations={2} />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Dismiss'}));

    expect(
      screen.queryByText(
        'Chat, ask questions, and debug with Sentry in the new Slack app. Please reinstall the slack app to get started.'
      )
    ).not.toBeInTheDocument();
  });

  it('stays dismissed across remounts within the session', async () => {
    const {unmount} = render(<UpdateSlackAlert num_configurations={2} />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Dismiss'}));
    unmount();

    render(<UpdateSlackAlert num_configurations={2} />, {organization});

    expect(screen.queryByRole('button', {name: 'Update Now'})).not.toBeInTheDocument();
  });
});
