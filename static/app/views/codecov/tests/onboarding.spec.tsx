import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import TestsOnboardingPage from 'sentry/views/codecov/tests/onboarding';

describe('TestsOnboardingPage', () => {
  it('renders with GitHub Actions selected by default if no query param is provided', () => {
    render(<TestsOnboardingPage />, {
      initialRouterConfig: {
        location: {
          pathname: '/codecov/tests/new',
          query: {},
        },
      },
    });

    const githubRadio = screen.getByLabelText('Use GitHub Actions to run my CI');
    expect(githubRadio).toBeChecked();

    const cliRadio = screen.getByLabelText(
      "Use Sentry Prevent's CLI to upload testing reports"
    );
    expect(cliRadio).not.toBeChecked();
  });

  it('renders with GitHub Actions selected by default if empty opt query param is provided', () => {
    render(<TestsOnboardingPage />, {
      initialRouterConfig: {
        location: {
          pathname: '/codecov/tests/new',
          query: {opt: ''},
        },
      },
    });

    const githubRadio = screen.getByLabelText('Use GitHub Actions to run my CI');
    expect(githubRadio).toBeChecked();

    const cliRadio = screen.getByLabelText(
      "Use Sentry Prevent's CLI to upload testing reports"
    );
    expect(cliRadio).not.toBeChecked();
  });

  it('renders with CLI selected when opt=cli in URL', () => {
    render(<TestsOnboardingPage />, {
      initialRouterConfig: {
        location: {
          pathname: '/codecov/tests/new',
          query: {opt: 'cli'},
        },
      },
    });

    const cliRadio = screen.getByLabelText(
      "Use Sentry Prevent's CLI to upload testing reports"
    );
    expect(cliRadio).toBeChecked();

    const githubRadio = screen.getByLabelText('Use GitHub Actions to run my CI');
    expect(githubRadio).not.toBeChecked();
  });

  it('updates URL when GitHub Actions option is selected', async () => {
    const {router} = render(<TestsOnboardingPage />, {
      initialRouterConfig: {
        location: {
          pathname: '/codecov/tests/new',
          query: {opt: 'cli'},
        },
      },
    });

    const githubRadio = screen.getByLabelText('Use GitHub Actions to run my CI');
    expect(githubRadio).not.toBeChecked();

    await userEvent.click(githubRadio);

    expect(router.location.search).toBe('?opt=githubAction');
  });

  it('updates URL when CLI option is selected', async () => {
    const {router} = render(<TestsOnboardingPage />, {
      initialRouterConfig: {
        location: {
          pathname: '/codecov/tests/new',
          query: {opt: ''},
        },
      },
    });

    const cliRadio = screen.getByLabelText(
      "Use Sentry Prevent's CLI to upload testing reports"
    );
    expect(cliRadio).not.toBeChecked();

    await userEvent.click(cliRadio);

    expect(router.location.search).toBe('?opt=cli');
  });
});
