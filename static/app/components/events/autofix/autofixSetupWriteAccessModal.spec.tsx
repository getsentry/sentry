import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';

import {act, renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {AutofixSetupWriteAccessModal} from 'sentry/components/events/autofix/autofixSetupWriteAccessModal';

describe('AutofixSetupWriteAccessModal', () => {
  it('displays help text when repos are not all installed', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/autofix/setup/',
      match: [MockApiClient.matchQuery({check_write_access: true})],
      body: AutofixSetupFixture({
        integration: {ok: true, reason: null},
        githubWriteIntegration: {
          ok: false,
          repos: [
            {
              provider: 'integrations:github',
              owner: 'getsentry',
              name: 'sentry',
              ok: true,
            },
            {
              provider: 'integrations:github',
              owner: 'getsentry',
              name: 'seer',
              ok: false,
            },
          ],
        },
      }),
    });

    const closeModal = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => <AutofixSetupWriteAccessModal {...modalProps} groupId="1" />,
        {
          onClose: closeModal,
        }
      );
    });

    expect(screen.getByText(/In order to create pull requests/i)).toBeInTheDocument();
    expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
    expect(screen.getByText('getsentry/seer')).toBeInTheDocument();

    expect(
      screen.getByRole('button', {name: 'Install the Seer GitHub App'})
    ).toHaveAttribute('href', 'https://github.com/apps/seer-by-sentry/installations/new');
  });

  it('renders GitLab repo URLs correctly', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/autofix/setup/',
      match: [MockApiClient.matchQuery({check_write_access: true})],
      body: AutofixSetupFixture({
        integration: {ok: true, reason: null},
        githubWriteIntegration: {
          ok: false,
          repos: [
            {
              provider: 'integrations:github',
              owner: 'getsentry',
              name: 'sentry',
              ok: true,
            },
            {
              provider: 'integrations:gitlab',
              owner: 'getsentry',
              name: 'gitlab-repo',
              ok: false,
            },
          ],
        },
      }),
    });

    const closeModal = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => <AutofixSetupWriteAccessModal {...modalProps} groupId="1" />,
        {
          onClose: closeModal,
        }
      );
    });

    // GitHub repo should link to github.com
    const githubLink = await screen.findByRole('link', {name: 'getsentry/sentry'});
    expect(githubLink).toHaveAttribute('href', 'https://github.com/getsentry/sentry');

    // GitLab repo should link to gitlab.com
    const gitlabLink = screen.getByRole('link', {name: 'getsentry/gitlab-repo'});
    expect(gitlabLink).toHaveAttribute(
      'href',
      'https://gitlab.com/getsentry/gitlab-repo'
    );
  });

  it('displays success text when installed repos for github app text', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1/autofix/setup/',
      match: [MockApiClient.matchQuery({check_write_access: true})],
      body: AutofixSetupFixture({
        integration: {ok: true, reason: null},
        githubWriteIntegration: {
          ok: true,
          repos: [
            {
              provider: 'integrations:github',
              owner: 'getsentry',
              name: 'sentry',
              ok: true,
            },
            {
              provider: 'integrations:github',
              owner: 'getsentry',
              name: 'seer',
              ok: true,
            },
          ],
        },
      }),
    });

    const closeModal = jest.fn();

    renderGlobalModal();

    act(() => {
      openModal(
        modalProps => <AutofixSetupWriteAccessModal {...modalProps} groupId="1" />,
        {onClose: closeModal}
      );
    });

    expect(
      await screen.findByText("You've successfully configured write access!")
    ).toBeInTheDocument();

    // Footer with actions should no longer be visible
    expect(screen.queryByRole('button', {name: /install/i})).not.toBeInTheDocument();
  });
});
