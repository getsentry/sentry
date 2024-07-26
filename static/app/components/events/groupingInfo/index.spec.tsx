import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {EventGroupingInfo} from 'sentry/components/events/groupingInfo';
import {EventGroupVariantType, IssueCategory} from 'sentry/types';

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
    group,
  };

  let groupingInfoRequest = jest.fn();

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
    render(<EventGroupingInfo {...defaultProps} />);

    await screen.findByText('variant description');

    // Hash should not be visible until toggling open
    expect(screen.queryByText('123')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show Details'}));
    expect(screen.getByText('123')).toBeInTheDocument();
  });

  it('gets performance grouping info from group/event data', async function () {
    const perfEvent = EventFixture({
      type: 'transaction',
      occurrence: {fingerprint: ['123'], evidenceData: {op: 'bad-op'}},
    });
    const perfGroup = GroupFixture({issueCategory: IssueCategory.PERFORMANCE});

    render(<EventGroupingInfo {...defaultProps} event={perfEvent} group={perfGroup} />);

    expect(screen.getByText('performance problem')).toBeInTheDocument();

    // Hash should not be visible until toggling open
    expect(screen.queryByText('123')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show Details'}));
    expect(screen.getByText('123')).toBeInTheDocument();

    // Should not make grouping-info request
    expect(groupingInfoRequest).not.toHaveBeenCalled();
  });
});
