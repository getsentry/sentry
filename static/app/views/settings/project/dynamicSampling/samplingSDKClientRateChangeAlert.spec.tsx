import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Project} from 'sentry/types';
import {SamplingSDKClientRateChangeAlert} from 'sentry/views/settings/project/dynamicSampling/samplingSDKClientRateChangeAlert';

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

describe('Server-Side Sampling - Client Rate Change Alert', function () {
  it('does not render content', function () {
    const {organization, project} = getMockData();

    render(
      <SamplingSDKClientRateChangeAlert
        organization={organization}
        projectId={project.id}
        onReadDocs={jest.fn()}
        projectStats={TestStubs.Outcomes()}
      />
    );

    expect(
      screen.queryByText(
        'To allow more transactions to be processed, we suggest changing your client(SDK) sample rate.'
      )
    ).not.toBeInTheDocument();
  });

  it('renders content with change sdk sample rate info', function () {
    const {organization, project} = getMockData();

    render(
      <SamplingSDKClientRateChangeAlert
        organization={organization}
        projectId={project.id}
        onReadDocs={jest.fn()}
        projectStats={TestStubs.OutcomesWithLowProcessedEvents()}
      />
    );

    expect(
      screen.getByText(
        'To allow more transactions to be processed, we suggest changing your client(SDK) sample rate.'
      )
    ).toBeInTheDocument();
  });
});
