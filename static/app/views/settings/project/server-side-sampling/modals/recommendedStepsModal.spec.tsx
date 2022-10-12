import {renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {openModal} from 'sentry/actionCreators/modal';
import {RecommendedStepsModal} from 'sentry/views/settings/project/server-side-sampling/modals/recommendedStepsModal';
import {SERVER_SIDE_SAMPLING_DOC_LINK} from 'sentry/views/settings/project/server-side-sampling/utils';

import {
  getMockData,
  mockedProjects,
  mockedSamplingSdkVersions,
  recommendedSdkUpgrades,
  uniformRule,
} from '../testUtils';

describe('Server-Side Sampling - Recommended Steps Modal', function () {
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
        'To activate Dynamic Sampling rules, it’s a requirement to update the following project SDK(s):'
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

    // Second recommended step
    expect(
      screen.getByRole('heading', {
        name: 'Adjust your Client-Side (SDK) sample rate',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'Here’s the new Client-Side (SDK) sample rate you specified in the previous step. To make this change, find the ‘tracesSampleRate’ option in your SDK Config, modify it’s value to what’s shown below and re-deploy.'
      )
    ).toBeInTheDocument();

    expect(screen.getByText(textWithMarkupMatcher(/Sentry.init/))).toBeInTheDocument();
    expect(screen.getByText('0.5')).toBeInTheDocument();
    expect(screen.getByText('// 50%')).toBeInTheDocument();

    // Footer
    expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
      'href',
      SERVER_SIDE_SAMPLING_DOC_LINK
    );

    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Done'})).toBeInTheDocument();

    expect(screen.queryByText('Step 2 of 2')).not.toBeInTheDocument();

    expect(screen.queryByRole('button', {name: 'Back'})).not.toBeInTheDocument();
  });

  it('render only the last recommended step', function () {
    const {organization, project} = getMockData();

    renderGlobalModal();

    openModal(modalProps => (
      <RecommendedStepsModal
        {...modalProps}
        organization={organization}
        projectId={project.id}
        recommendedSdkUpgrades={[]}
        onSubmit={jest.fn()}
        onReadDocs={jest.fn()}
        clientSampleRate={uniformRule.sampleRate}
      />
    ));

    expect(
      screen.queryByRole('heading', {
        name: 'Update the following SDK versions',
      })
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole('heading', {
        name: 'Adjust your Client-Side (SDK) sample rate',
      })
    ).toBeInTheDocument();
  });

  it('render as a second step of a wizard', function () {
    const {organization, project} = getMockData();

    const onGoBack = jest.fn();

    renderGlobalModal();

    openModal(modalProps => (
      <RecommendedStepsModal
        {...modalProps}
        organization={organization}
        projectId={project.id}
        recommendedSdkUpgrades={[]}
        onGoBack={onGoBack}
        onSubmit={jest.fn()}
        onReadDocs={jest.fn()}
        clientSampleRate={uniformRule.sampleRate}
      />
    ));

    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument();
    userEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(onGoBack).toHaveBeenCalled();
  });

  it('renders 3/3 footer', function () {
    const {organization, project} = getMockData();

    renderGlobalModal();

    openModal(modalProps => (
      <RecommendedStepsModal
        {...modalProps}
        organization={organization}
        projectId={project.id}
        recommendedSdkUpgrades={[]}
        onGoBack={jest.fn()}
        onSubmit={jest.fn()}
        onReadDocs={jest.fn()}
        clientSampleRate={uniformRule.sampleRate}
        specifiedClientRate={0.1}
      />
    ));

    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
  });
});
