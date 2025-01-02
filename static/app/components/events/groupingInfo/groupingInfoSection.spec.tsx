import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {EventGroupVariantType} from 'sentry/types/event';
import {IssueCategory} from 'sentry/types/group';

import {EventGroupingInfoSection} from './groupingInfoSection';

describe('EventGroupingInfo', function () {
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
        app: {
          description: 'variant description',
          hash: '123',
          hashMismatch: false,
          key: 'key',
          type: EventGroupVariantType.CHECKSUM,
        },
      },
    });
  });

  it('fetches and renders grouping info for errors', async function () {
    render(<EventGroupingInfoSection {...defaultProps} />);

    expect(await screen.findByText('variant description')).toBeInTheDocument();

    // Hash should not be visible until toggling open
    expect(screen.queryByText('123')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show Details'}));
    expect(await screen.findByText('123')).toBeInTheDocument();
  });

  it('gets performance grouping info from group/event data', async function () {
    const perfEvent = EventFixture({
      type: 'transaction',
      occurrence: {fingerprint: ['123'], evidenceData: {op: 'bad-op'}},
    });
    const perfGroup = GroupFixture({issueCategory: IssueCategory.PERFORMANCE});

    render(
      <EventGroupingInfoSection {...defaultProps} event={perfEvent} group={perfGroup} />
    );

    expect(screen.getByText('performance problem')).toBeInTheDocument();

    // Hash should not be visible until toggling open
    expect(screen.queryByText('123')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show Details'}));
    expect(screen.getByText('123')).toBeInTheDocument();

    // Should not make grouping-info request
    expect(groupingInfoRequest).not.toHaveBeenCalled();
  });

  it('can switch grouping configs', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/grouping-configs/`,
      body: [
        {id: 'default:XXXX', hidden: false},
        {id: 'new:XXXX', hidden: false},
      ],
    });

    render(<EventGroupingInfoSection {...defaultProps} showGroupingConfig />);

    await userEvent.click(screen.getByRole('button', {name: 'Show Details'}));

    // Should show first hash
    await screen.findByText('123');

    expect(screen.getByText('default:XXXX')).toBeInTheDocument();

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/events/${event.id}/grouping-info/`,
      query: {config: 'new:XXXX'},
      body: {
        app: {
          description: 'variant description',
          hash: '789',
          hashMismatch: false,
          key: 'key',
          type: EventGroupVariantType.CHECKSUM,
        },
      },
    });

    await userEvent.click(screen.getAllByRole('button', {name: 'default:XXXX'})[0]!);
    await userEvent.click(screen.getByRole('option', {name: 'new:XXXX'}));

    // Should show new hash
    expect(await screen.findByText('789')).toBeInTheDocument();
  });
});
