import {Fragment} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import {SamplingSDKAlert} from 'sentry/views/settings/project/server-side-sampling/samplingSDKAlert';

import {getMockData, mockedProjects, recommendedSdkUpgrades, uniformRule} from './utils';

describe('Server-side Sampling - Sampling SDK Alert', function () {
  it('does not render content', function () {
    const {organization, project} = getMockData();

    render(
      <SamplingSDKAlert
        organization={organization}
        projectId={project.id}
        onReadDocs={jest.fn()}
        rules={[uniformRule]}
        recommendedSdkUpgrades={[]}
        showLinkToTheModal
      />
    );

    expect(
      screen.queryByTestId('recommended-sdk-upgrades-alert')
    ).not.toBeInTheDocument();
  });

  it('renders content with not active rule info', function () {
    const {organization, project} = getMockData();

    render(
      <Fragment>
        <GlobalModal />
        <SamplingSDKAlert
          organization={organization}
          projectId={project.id}
          onReadDocs={jest.fn()}
          rules={[uniformRule]}
          recommendedSdkUpgrades={recommendedSdkUpgrades}
          showLinkToTheModal
        />
      </Fragment>
    );

    expect(screen.getByTestId('recommended-sdk-upgrades-alert')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Learn More'})).toBeInTheDocument();

    expect(
      screen.getByText(
        'To keep a consistent amount of transactions across your applications multiple services, we recommend you update the SDK versions for the following project:'
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
      screen.getByRole('heading', {name: 'Update the following SDK versions'})
    ).toBeInTheDocument();
  });

  it('renders content with active rule info', function () {
    const {organization, project} = getMockData();

    render(
      <SamplingSDKAlert
        organization={organization}
        projectId={project.id}
        onReadDocs={jest.fn()}
        rules={[{...uniformRule, active: true}]}
        recommendedSdkUpgrades={recommendedSdkUpgrades}
        showLinkToTheModal
      />
    );

    expect(screen.getByTestId('recommended-sdk-upgrades-alert')).toBeInTheDocument();

    userEvent.click(screen.getByRole('button', {name: 'Resolve Now'}));

    expect(
      screen.getByText(
        'Server-side sampling rules are in effect without the following SDK’s being updated to their latest version.'
      )
    ).toBeInTheDocument();
  });
});
