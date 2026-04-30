import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
  it('gets performance new grouping info from group/event data', async () => {
    groupingInfoRequest = MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/events/${event.id}/grouping-info/`,
      body: {
        grouping_config: null,
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
});
