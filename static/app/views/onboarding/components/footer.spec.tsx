import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {PersistedStoreProvider} from 'sentry/stores/persistedStore';
import * as useSessionStorage from 'sentry/utils/useSessionStorage';
import {Footer, OnboardingStatus} from 'sentry/views/onboarding/components/footer';

describe('Onboarding Footer', function () {
  it('waiting for error ui', async function () {
    const {project, organization, router, route} = initializeOrg();

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });

    render(
      <PersistedStoreProvider>
        <Footer
          projectSlug={project.slug}
          location={router.location}
          route={route}
          router={router}
        />
      </PersistedStoreProvider>,
      {
        organization,
      }
    );

    // Skip onboarding link
    expect(screen.getByRole('link', {name: 'Skip Onboarding'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?referrer=onboarding-first-event-footer-skip'
    );

    // Error status
    expect(screen.getByText('Waiting for error')).toBeInTheDocument();

    // Explore Sentry button disabled
    expect(screen.getByRole('button', {name: 'Explore Sentry'})).toBeDisabled();

    userEvent.hover(screen.getByRole('button', {name: 'Explore Sentry'}));

    // Explore Sentry button tooltip
    await waitFor(() => {
      expect(screen.getAllByText('Waiting for error')).toHaveLength(2);
    });
  });

  it('processing error ui', async function () {
    const {project, organization, router, route} = initializeOrg();

    // Mock useSessionStorage hook to return the mocked session data
    jest.spyOn(useSessionStorage, 'useSessionStorage').mockImplementation(() => [
      {
        status: OnboardingStatus.PROCESSING,
        firstIssueId: undefined,
      },
      jest.fn(),
      jest.fn(),
    ]);

    render(
      <PersistedStoreProvider>
        <Footer
          projectSlug={project.slug}
          location={router.location}
          route={route}
          router={router}
        />
      </PersistedStoreProvider>,
      {
        organization,
      }
    );

    // Skip onboarding link is gone
    expect(screen.queryByRole('link', {name: 'Skip Onboarding'})).not.toBeInTheDocument();

    // Error status
    expect(screen.getByText('Processing error')).toBeInTheDocument();

    renderGlobalModal();

    userEvent.click(screen.getByRole('button', {name: 'Explore Sentry'}));

    // Display are you sure modal
    expect(await screen.findByText('Are you sure?')).toBeInTheDocument();
  });

  it('error processed ui', function () {
    const {project, organization, router, route} = initializeOrg();

    // Mock useSessionStorage hook to return the mocked session data
    jest.spyOn(useSessionStorage, 'useSessionStorage').mockImplementation(() => [
      {
        status: OnboardingStatus.PROCESSED,
        firstIssueId: '1',
      },
      jest.fn(),
      jest.fn(),
    ]);

    render(
      <PersistedStoreProvider>
        <Footer
          projectSlug={project.slug}
          location={router.location}
          route={route}
          router={router}
        />
      </PersistedStoreProvider>,
      {
        organization,
      }
    );

    // Skip onboarding link is gone
    expect(screen.queryByRole('link', {name: 'Skip Onboarding'})).not.toBeInTheDocument();

    // Error status
    expect(screen.getByText('Error Processed!')).toBeInTheDocument();

    // View error button is rendered
    expect(screen.getByRole('button', {name: 'View Error'})).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', {name: 'View Error'}));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname:
          '/organizations/org-slug/issues/1/?referrer=onboarding-first-event-footer',
      })
    );
  });
});
