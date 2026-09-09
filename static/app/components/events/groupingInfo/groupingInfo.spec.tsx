import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {EventGroupVariantType} from 'sentry/types/event';
import {IssueCategory} from 'sentry/types/group';

import GroupingInfo from './groupingInfo';

describe('EventGroupingInfo', () => {
  const group = GroupFixture();
  const event = EventFixture({
    groupingConfig: {
      id: 'default:XXXX',
    },
  });

  const defaultProps = {
    event,
    projectSlug: 'project-slug',
    showGroupingConfig: false,
    group,
  };

  let groupingInfoRequest!: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    groupingInfoRequest = MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/events/${event.id}/grouping-info/`,
      body: {
        grouping_config: 'default:XXXX',
        variants: {
          app: {
            contributes: true,
            description: 'variant description',
            hash: '123',
            hashMismatch: false,
            key: 'key',
            type: EventGroupVariantType.CHECKSUM,
          },
        },
      },
    });
  });

  it('gets performance grouping info from group/event data', async () => {
    const perfEvent = EventFixture({
      type: 'transaction',
      occurrence: {fingerprint: ['123'], evidenceData: {op: 'bad-op'}},
    });
    const perfGroup = GroupFixture({issueCategory: IssueCategory.PERFORMANCE});

    render(<GroupingInfo {...defaultProps} event={perfEvent} group={perfGroup} />);

    expect(await screen.findByText('performance problem')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    // Should not make grouping-info request
    expect(groupingInfoRequest).not.toHaveBeenCalled();
  });

  it('works with new groupingInfo format', async () => {
    groupingInfoRequest = MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/events/${event.id}/grouping-info/`,
      body: {
        grouping_config: 'default:XXXX',
        variants: {
          app: {
            contributes: true,
            description: 'variant description',
            hash: '123',
            hashMismatch: false,
            key: 'key',
            type: EventGroupVariantType.CHECKSUM,
          },
        },
      },
    });
    render(<GroupingInfo {...defaultProps} />);

    expect(await screen.findByText('variant description')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });
  it('filters non-contributing variants and keeps the summary unchanged', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/events/${event.id}/grouping-info/`,
      body: {
        grouping_config: 'default:XXXX',
        variants: {
          app: {
            key: 'app',
            type: EventGroupVariantType.CHECKSUM,
            contributes: true,
            description: 'stacktrace',
            hash: '123',
          },
          fallback: {
            key: 'fallback',
            type: EventGroupVariantType.CHECKSUM,
            contributes: false,
            description: 'message',
            hash: null,
          },
        },
      },
    });
    render(<GroupingInfo {...defaultProps} showGroupingConfig />);

    expect(await screen.findByTestId('loaded-grouping-info')).toHaveTextContent(
      'Grouped by: stacktrace'
    );
    expect(screen.getByTestId('loaded-grouping-info')).toHaveTextContent(
      'Grouping Config: default:XXXX'
    );
    expect(screen.queryByRole('heading', {name: 'Message'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', {name: 'All Values'}));
    expect(screen.getByRole('heading', {name: 'Message'})).toBeInTheDocument();
    expect(screen.getByTestId('loaded-grouping-info')).toHaveTextContent(
      'Grouped by: stacktrace'
    );
    await userEvent.click(screen.getByRole('radio', {name: 'Contributing Values'}));
    expect(screen.queryByRole('heading', {name: 'Message'})).not.toBeInTheDocument();
  });

  it('shows an empty summary when no variants contribute', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/events/${event.id}/grouping-info/`,
      body: {grouping_config: null, variants: {}},
    });
    render(<GroupingInfo {...defaultProps} />);
    expect(await screen.findByTestId('loaded-grouping-info')).toHaveTextContent(
      'Grouped by: nothing'
    );
  });

  it('shows a fetch error without a misleading grouping summary', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/events/${event.id}/grouping-info/`,
      statusCode: 500,
    });
    render(<GroupingInfo {...defaultProps} />);
    expect(await screen.findByText('Failed to fetch grouping info.')).toBeInTheDocument();
    expect(screen.queryByTestId('loaded-grouping-info')).not.toBeInTheDocument();
  });
});
