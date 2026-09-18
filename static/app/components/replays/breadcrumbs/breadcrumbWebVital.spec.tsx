import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {hydrateSpans} from 'sentry/utils/replays/hydrateSpans';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import type {WebVitalFrame} from 'sentry/utils/replays/types';
import {BreadcrumbWebVital} from 'sentry/components/replays/breadcrumbs/breadcrumbWebVital';

jest.mock('sentry/utils/replays/playback/providers/replayReaderProvider');

describe('BreadcrumbWebVital', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    jest.mocked(useReplayReader).mockReturnValue(null);
  });

  it('renders nothing when frame.data is undefined (legacy SDK frames)', () => {
    // Simulate a web-vital frame from an older SDK (<8.22.0) that omits data
    const [frame] = hydrateSpans(ReplayRecordFixture(), [
      {
        op: 'web-vital',
        description: 'largest-contentful-paint',
        startTimestamp: new Date('2024/06/21').getTime() / 1000,
        endTimestamp: new Date('2024/06/21').getTime() / 1000,
        data: undefined,
      } as any,
    ]);

    const {container} = render(
      <BreadcrumbWebVital
        frame={frame as WebVitalFrame}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        onInspectorExpanded={() => {}}
      />,
      {organization}
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders web vital data when frame.data is defined', () => {
    const [frame] = hydrateSpans(ReplayRecordFixture(), [
      {
        op: 'web-vital',
        description: 'largest-contentful-paint',
        startTimestamp: new Date('2024/06/21').getTime() / 1000,
        endTimestamp: new Date('2024/06/21').getTime() / 1000,
        data: {value: 1234, size: 0, nodeIds: [], attributions: []},
      } as any,
    ]);

    render(
      <BreadcrumbWebVital
        frame={frame as WebVitalFrame}
        onMouseEnter={() => {}}
        onMouseLeave={() => {}}
        onInspectorExpanded={() => {}}
      />,
      {organization}
    );

    expect(screen.getByText('All Web Vitals')).toBeInTheDocument();
  });
});
