import {initializeOrg} from 'sentry-test/initializeOrg';
import {renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {openModal} from 'sentry/actionCreators/modal';
import {Project} from 'sentry/types';
import {RecommendedStepsModal} from 'sentry/views/settings/project/dynamicSampling/modals/recommendedStepsModal';

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

describe('Dynamic Sampling - Recommended Steps Modal', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/release/values/',
      method: 'GET',
      body: [{value: '1.2.3'}],
    });
  });

  it('render all recommended steps', function () {
    const {organization, projects} = getMockData({
      projects: TestStubs.DynamicSamplingConfig().projects,
    });

    renderGlobalModal();

    openModal(modalProps => (
      <RecommendedStepsModal
        {...modalProps}
        organization={organization}
        projectId={projects[0].id}
        recommendedSdkUpgrades={TestStubs.DynamicSamplingConfig().recommendedSdkUpgrades}
        onReadDocs={jest.fn()}
      />
    ));

    expect(screen.getByText('Important next steps')).toBeInTheDocument();

    // First recommended step
    expect(
      screen.getByRole('heading', {
        name: 'Update the following SDK versions',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'To activate Dynamic Sampling rules, it’s a requirement to update the following project SDK(s):'
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('link', {name: projects[1].slug})).toHaveAttribute(
      'href',
      `/organizations/org-slug/projects/sentry/?project=${projects[1].id}`
    );

    expect(screen.getByTestId('platform-icon-python')).toBeInTheDocument();

    expect(
      screen.getByText(
        textWithMarkupMatcher(
          `This project is on ${
            TestStubs.DynamicSamplingConfig().samplingSdkVersions[1].latestSDKName
          }@v${TestStubs.DynamicSamplingConfig().samplingSdkVersions[1].latestSDKVersion}`
        )
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Got it'})).toBeInTheDocument();
  });
});
