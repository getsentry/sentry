import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import {SamplingSDKUpgradesAlert} from 'sentry/views/settings/project/server-side-sampling/samplingSDKUpgradesAlert';

import {getMockInitializeOrg, mockedProjects, recommendedSdkUpgrades} from './testUtils';

function ComponentProviders({children}: {children: React.ReactNode}) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('Server-Side Sampling - Sdk Upgrades Alert', function () {
  it('does not render content', function () {
    const {organization, project} = getMockInitializeOrg();

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/dynamic-sampling/distribution/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/stats_v2/',
      method: 'GET',
      body: TestStubs.Outcomes(),
    });

    render(
      <ComponentProviders>
        <SamplingSDKUpgradesAlert
          organization={organization}
          projectId={project.id}
          onReadDocs={jest.fn()}
          recommendedSdkUpgrades={[]}
          projectSlug={project.slug}
          hasAccess
        />
      </ComponentProviders>
    );

    expect(
      screen.queryByTestId('recommended-sdk-upgrades-alert')
    ).not.toBeInTheDocument();
  });

  it('renders content with update sdks info', function () {
    const {organization, project} = getMockInitializeOrg();

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/dynamic-sampling/distribution/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/stats_v2/',
      method: 'GET',
      body: TestStubs.Outcomes(),
    });

    render(
      <ComponentProviders>
        <GlobalModal />
        <SamplingSDKUpgradesAlert
          organization={organization}
          projectId={project.id}
          onReadDocs={jest.fn()}
          recommendedSdkUpgrades={recommendedSdkUpgrades}
          projectSlug={project.slug}
          hasAccess
        />
      </ComponentProviders>
    );

    expect(screen.getByTestId('recommended-sdk-upgrades-alert')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Learn More'})).toBeInTheDocument();

    expect(
      screen.getByText(
        'To activate sampling rules, it’s a requirement to update the following project SDK(s):'
      )
    ).toBeInTheDocument();

    expect(screen.getByTestId('platform-icon-python')).toBeInTheDocument();
    expect(screen.getByTestId('badge-display-name')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: mockedProjects[1].slug})).toHaveAttribute(
      'href',
      `/organizations/org-slug/projects/sentry/?project=${mockedProjects[1].id}`
    );

    // Click on learn more button
    userEvent.click(screen.getByRole('button', {name: 'Learn More'}));

    // Recommended steps modal is rendered
    expect(
      screen.getByRole('heading', {
        name: 'Update the following SDK versions',
      })
    ).toBeInTheDocument();
  });
});
