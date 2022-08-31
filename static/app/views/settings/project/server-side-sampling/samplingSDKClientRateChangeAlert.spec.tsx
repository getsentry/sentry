import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SamplingSDKClientRateChangeAlert} from 'sentry/views/settings/project/server-side-sampling/samplingSDKClientRateChangeAlert';

import {getMockData} from './testUtils';

const otherOutcomesGroups = TestStubs.Outcomes().groups.filter(
  group => group.by.outcome !== 'accepted' && group.by.outcome !== 'client_discard'
);

const stats = {
  ...TestStubs.Outcomes(),
  groups: [
    ...otherOutcomesGroups,
    {
      by: {outcome: 'accepted'},
      totals: {'sum(quantity)': 1231342},
      series: {
        'sum(quantity)': [
          0, 0, 0, 1, 94, 1, 1, 0, 566, 179, 1, 1, 1, 0, 222, 6, 287, 465, 83, 7, 0, 1835,
          145, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 1, 849, 25331, 147200, 220014, 189001, 99590,
          81288, 134522, 151489, 128585, 41643, 6404, 145, 1381,
        ],
      },
    },
    {
      by: {outcome: 'client_discard'},
      totals: {'sum(quantity)': 18868070},
      series: {
        'sum(quantity)': [
          0, 0, 0, 259581, 246831, 278464, 290677, 242770, 242559, 248963, 250920, 268994,
          296129, 308165, 302398, 301891, 316698, 333888, 336204, 329735, 323717, 317564,
          312407, 307008, 301681, 299652, 276849, 274486, 298985, 368148, 444434, 423119,
          416110, 464443, 526387, 692300, 720026, 719854, 719658, 719237, 717889, 719757,
          718147, 719843, 712099, 643028, 545065, 311310,
        ],
      },
    },
  ],
};

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
        'To allow more metrics to be processed, we suggest changing your client(SDK) sample rate.'
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
        projectStats={stats}
      />
    );

    expect(
      screen.getByText(
        'To allow more metrics to be processed, we suggest changing your client(SDK) sample rate.'
      )
    ).toBeInTheDocument();
  });
});
