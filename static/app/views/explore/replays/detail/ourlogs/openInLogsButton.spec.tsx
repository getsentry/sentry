import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {OpenInLogsButton} from 'sentry/views/explore/replays/detail/ourlogs/openInLogsButton';

function Wrapper({children}: {children: React.ReactNode}) {
  return (
    <LogsQueryParamsProvider
      analyticsPageSource={LogsAnalyticsPageSource.REPLAY_DETAILS}
      source="state"
    >
      {children}
    </LogsQueryParamsProvider>
  );
}

describe('OpenInLogsButton', () => {
  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {period: '14d', start: null, end: null, utc: false},
    });
  });

  it('renders nothing when the explore feature flag is disabled', () => {
    const organization = OrganizationFixture({features: []});

    const {container} = render(
      <Wrapper>
        <OpenInLogsButton replayId="abc123" />
      </Wrapper>,
      {organization}
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the button when the explore feature flag is enabled', () => {
    const organization = OrganizationFixture({
      features: ['visibility-explore-view'],
    });

    render(
      <Wrapper>
        <OpenInLogsButton />
      </Wrapper>,
      {organization}
    );

    expect(screen.getByRole('button', {name: 'Open in Logs'})).toBeInTheDocument();
  });

  it('appends replay_id to the URL when replayId is provided', () => {
    const organization = OrganizationFixture({
      features: ['visibility-explore-view'],
    });

    render(
      <Wrapper>
        <OpenInLogsButton replayId="deadbeef" />
      </Wrapper>,
      {organization}
    );

    const link = screen.getByRole('button', {name: 'Open in Logs'});
    expect(link).toHaveAttribute('href', expect.stringContaining('replay_id%3Adeadbeef'));
  });

  it('includes the existing search query before replay_id in the URL', () => {
    const organization = OrganizationFixture({
      features: ['visibility-explore-view'],
    });

    render(
      <Wrapper>
        <OpenInLogsButton replayId="deadbeef" />
      </Wrapper>,
      {organization}
    );

    const link = screen.getByRole('button', {name: 'Open in Logs'});
    expect(link).toHaveAttribute(
      'href',
      expect.stringMatching(/logsQuery=.*replay_id%3Adeadbeef/)
    );
  });
});
