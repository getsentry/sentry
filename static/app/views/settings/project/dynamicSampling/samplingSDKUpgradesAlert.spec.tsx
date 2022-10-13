import {Fragment} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import {Project} from 'sentry/types';
import {SamplingSDKUpgradesAlert} from 'sentry/views/settings/project/dynamicSampling/samplingSDKUpgradesAlert';

function getMockData({projects, access}: {access?: string[]; projects?: Project[]} = {}) {
  return initializeOrg({
    ...initializeOrg(),
    organization: {
      ...initializeOrg().organization,
      features: [
        'server-side-sampling',
        'server-side-sampling-ui',
        'dynamic-sampling-basic',
      ],
      access: access ?? initializeOrg().organization.access,
      projects,
    },
    projects,
  });
}

describe('Dynamic Sampling - Sdk Upgrades Alert', function () {
  it('does not render content', function () {
    const {organization, project} = getMockData();

    render(
      <SamplingSDKUpgradesAlert
        organization={organization}
        projectId={project.id}
        onReadDocs={jest.fn()}
        recommendedSdkUpgrades={[]}
      />
    );

    expect(
      screen.queryByTestId('recommended-sdk-upgrades-alert')
    ).not.toBeInTheDocument();
  });

  it('renders content with update sdks info', function () {
    const {organization, projects} = getMockData({
      projects: TestStubs.DynamicSamplingConfig().projects,
    });

    render(
      <Fragment>
        <GlobalModal />
        <SamplingSDKUpgradesAlert
          organization={organization}
          projectId={projects[2].id}
          onReadDocs={jest.fn()}
          recommendedSdkUpgrades={
            TestStubs.DynamicSamplingConfig().recommendedSdkUpgrades
          }
        />
      </Fragment>
    );

    expect(screen.getByTestId('recommended-sdk-upgrades-alert')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Learn More'})).toBeInTheDocument();

    expect(
      screen.getByText(
        'To activate sampling rules, it’s a requirement to update the following project SDK(s):'
      )
    ).toBeInTheDocument();

    // expect(screen.getByTestId('platform-icon-sentry')).toBeInTheDocument();
    expect(screen.getByTestId('badge-display-name')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: projects[1].slug})).toHaveAttribute(
      'href',
      `/organizations/org-slug/projects/sentry/?project=${projects[1].id}`
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
