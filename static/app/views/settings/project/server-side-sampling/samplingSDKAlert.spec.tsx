import {Fragment} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GlobalModal from 'sentry/components/globalModal';
import {SamplingSDKAlert} from 'sentry/views/settings/project/server-side-sampling/samplingSDKAlert';

import {getMockData, mockedProjects, recommendedSdkUpgrades, uniformRule} from './utils';

describe('Server-Side Sampling - Sampling SDK Alert', function () {
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

  it('renders content with update sdks info', function () {
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
        'To activate server-side sampling rules, it’s a requirement to update the following project SDK(s):'
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
