import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SamplingSDKClientRateChangeAlert} from 'sentry/views/settings/project/server-side-sampling/samplingSDKClientRateChangeAlert';

import {getMockData} from './testUtils';

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
