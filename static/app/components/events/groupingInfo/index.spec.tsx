import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {EventGroupingInfo} from 'sentry/components/events/groupingInfo';
import {EventGroupVariantType, IssueCategory} from 'sentry/types';

describe('EventGroupingInfo', function () {
  const group = GroupFixture();
  const event = EventFixture();

  const defaultProps = {
    event,
    projectSlug: 'project-slug',
    showGroupingConfig: true,
    group,
  };

  it('fetches and renders grouping info for errors', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/events/${event.id}/grouping-info/`,
      body: {
        app: {
          description: 'variant description',
          hash: '123',
          hasMismatch: false,
          key: 'key',
          type: EventGroupVariantType.CHECKSUM,
        },
      },
    });

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
  });
});
