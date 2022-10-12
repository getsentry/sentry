import {renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {openModal} from 'sentry/actionCreators/modal';
import {RecommendedStepsModal} from 'sentry/views/settings/project/dynamicSampling/modals/recommendedStepsModal';
import {SERVER_SIDE_SAMPLING_DOC_LINK} from 'sentry/views/settings/project/dynamicSampling/utils';

import {
  getMockData,
  mockedProjects,
  mockedSamplingSdkVersions,
  recommendedSdkUpgrades,
} from '../testUtils';

describe('Dynamic Sampling - Recommended Steps Modal', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/release/values/',
      method: 'GET',
      body: [{value: '1.2.3'}],
    });
  });

  it('render all recommended steps', function () {
    const {organization, project} = getMockData();

    renderGlobalModal();

    openModal(modalProps => (
      <RecommendedStepsModal
        {...modalProps}
        organization={organization}
        projectId={project.id}
        recommendedSdkUpgrades={recommendedSdkUpgrades}
        onReadDocs={jest.fn()}
        onSubmit={jest.fn()}
        clientSampleRate={0.5}
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
        'To have Dynamic Sampling up and running, it’s a requirement to update the following project SDK(s):'
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('link', {name: mockedProjects[1].slug})).toHaveAttribute(
      'href',
      `/organizations/org-slug/projects/sentry/?project=${mockedProjects[1].id}`
    );

    expect(screen.getByTestId('platform-icon-python')).toBeInTheDocument();

    expect(
      screen.getByText(
        textWithMarkupMatcher(
          `This project is on ${mockedSamplingSdkVersions[1].latestSDKName}@v${mockedSamplingSdkVersions[1].latestSDKVersion}`
        )
      )
    ).toBeInTheDocument();

    // Footer
    expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
      'href',
      SERVER_SIDE_SAMPLING_DOC_LINK
    );

    expect(screen.getByRole('button', {name: 'Got it'})).toBeInTheDocument();
  });
});
