import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {openModal} from 'sentry/actionCreators/modal';
import GlobalModal from 'sentry/components/globalModal';
import {RecommendedStepsModal} from 'sentry/views/settings/project/server-side-sampling/modals/recommendedStepsModal';
import {SERVER_SIDE_SAMPLING_DOC_LINK} from 'sentry/views/settings/project/server-side-sampling/utils';

import {
  getMockData,
  mockedProjects,
  mockedSamplingSdkVersions,
  recommendedSdkUpgrades,
  uniformRule,
} from '../utils';

describe('Server-side Sampling - Recommended Steps Modal', function () {
  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/release/values/',
      method: 'GET',
      body: [{value: '1.2.3'}],
    });
  });

  it('render all recommended steps', function () {
    const {organization, project} = getMockData();

    render(<GlobalModal />);

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

    expect(screen.getByText('Next steps')).toBeInTheDocument();

    // First recommended step
    expect(
      screen.getByRole('heading', {
        name: 'Update your SDK(s) before defining sample rules',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'To ensure you are properly monitoring the performance of all your other services, we require you update to the latest version of the following SDK(s):'
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
        name: 'Increase your client-side transaction sample rate',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'Once you’ve updated the above SDK(s), you can increase the client-side transaction sample rate in your application. This helps to ensure you are sending enough transactions to accurately monitor overall performance and ensure all transactions you have deemed important in your server-side sample rules are available. Below is the suggested rate we’ve calculated based on your organization’s usage and quota.'
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

    render(<GlobalModal />);

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
        name: 'Update your SDK(s) before defining sample rules',
      })
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole('heading', {
        name: 'Increase your client-side transaction sample rate',
      })
    ).toBeInTheDocument();
  });

  it('render as a second step of a wizard', function () {
    const {organization, project} = getMockData();

    const onGoBack = jest.fn();

    render(<GlobalModal />);

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
});
