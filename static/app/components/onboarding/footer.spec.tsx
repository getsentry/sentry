import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {Footer} from 'sentry/components/onboarding/footer';
import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import {PersistedStoreProvider} from 'sentry/stores/persistedStore';
import {OnboardingStatus} from 'sentry/types';
import * as useSessionStorage from 'sentry/utils/useSessionStorage';

describe('Onboarding Footer', function () {
  it('waiting for error ui', async function () {
    const {project, organization, router, route} = initializeOrg();

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });

    render(
      <OnboardingContextProvider>
        <PersistedStoreProvider>
          <Footer
            projectId={project.id}
            projectSlug={project.slug}
            location={router.location}
            route={route}
            router={router}
            newOrg
          />
        </PersistedStoreProvider>
      </OnboardingContextProvider>,
      {
        organization,
      }
    );

    // Error status
    expect(screen.getByText('Waiting for error')).toBeInTheDocument();

    // Explore Sentry button disabled
    expect(screen.getByRole('button', {name: 'Explore Sentry'})).toBeDisabled();

    await userEvent.hover(screen.getByRole('button', {name: 'Explore Sentry'}));

    // Explore Sentry button tooltip
    await waitFor(() => {
      expect(screen.getAllByText('Waiting for error')).toHaveLength(2);
    });

    renderGlobalModal();

    // Skip onboarding link
    await userEvent.click(screen.getByRole('button', {name: 'Skip Onboarding'}));

    // Display are you sure modal
    expect(await screen.findByText('Are you sure?')).toBeInTheDocument();
  });

  it('processing error ui', async function () {
    const {project, organization, router, route} = initializeOrg();

    // Mock useSessionStorage hook to return the mocked session data
    jest.spyOn(useSessionStorage, 'useSessionStorage').mockImplementation(() => [
      {
        [project.id]: {
          status: OnboardingStatus.PROCESSING,
          firstIssueId: '1',
          slug: project.slug,
        },
      },
      jest.fn(),
      jest.fn(),
    ]);

    render(
      <OnboardingContextProvider>
        <PersistedStoreProvider>
          <Footer
            projectId={project.id}
            projectSlug={project.slug}
            location={router.location}
            route={route}
            router={router}
            newOrg
          />
        </PersistedStoreProvider>
      </OnboardingContextProvider>,
      {
        organization,
      }
    );

    // Skip onboarding link is gone
    expect(
      screen.queryByRole('button', {name: 'Skip Onboarding'})
    ).not.toBeInTheDocument();

    // Error status
    expect(screen.getByText('Processing error')).toBeInTheDocument();

    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Explore Sentry'}));

    // Display are you sure modal
    expect(await screen.findByText('Are you sure?')).toBeInTheDocument();
  });

  it('error processed ui', async function () {
    const {project, organization, router, route} = initializeOrg();

    // Mock useSessionStorage hook to return the mocked session data
    jest.spyOn(useSessionStorage, 'useSessionStorage').mockImplementation(() => [
      {
        [project.id]: {
          status: OnboardingStatus.PROCESSED,
          firstIssueId: '1',
          slug: project.slug,
        },
      },
      jest.fn(),
      jest.fn(),
    ]);

    render(
      <OnboardingContextProvider>
        <PersistedStoreProvider>
          <Footer
            projectId={project.id}
            projectSlug={project.slug}
            location={router.location}
            route={route}
            router={router}
            newOrg
          />
        </PersistedStoreProvider>
      </OnboardingContextProvider>,
      {
        organization,
      }
    );

    // Skip onboarding link is gone
    expect(
      screen.queryByRole('button', {name: 'Skip Onboarding'})
    ).not.toBeInTheDocument();

    // Error status
    expect(screen.getByText('Error Processed!')).toBeInTheDocument();

    // View error button is rendered
    expect(screen.getByRole('button', {name: 'View Error'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'View Error'}));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname:
          '/organizations/org-slug/issues/1/?referrer=onboarding-first-event-footer',
      })
    );
  });
});
