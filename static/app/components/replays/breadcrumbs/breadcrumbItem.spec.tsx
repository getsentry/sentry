import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReplayClickFrameFixture} from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import BreadcrumbItem from 'sentry/components/replays/breadcrumbs/breadcrumbItem';
import hydrateBreadcrumbs from 'sentry/utils/replays/hydrateBreadcrumbs';

const [MOCK_FRAME] = hydrateBreadcrumbs(ReplayRecordFixture(), [
  ReplayClickFrameFixture({
    timestamp: new Date('2024/06/21'),
  }),
]);

describe('BreadcrumbItem', function () {
  const organization = OrganizationFixture();

  it('displays the breadcrumb item', async function () {
    const mockClick = jest.fn();
    const mockMouseEnter = jest.fn();
    const mockMouseLeave = jest.fn();
    render(
      <BreadcrumbItem
        frame={MOCK_FRAME!}
        onMouseEnter={mockMouseEnter}
        onMouseLeave={mockMouseLeave}
        onClick={mockClick}
        onInspectorExpanded={() => {}}
        startTimestampMs={MOCK_FRAME!.timestampMs}
      />,
      {organization}
    );

    const title = screen.getByText('User Click');
    expect(title).toBeInTheDocument();
    expect(screen.getByText('00:00')).toBeInTheDocument();

    await userEvent.hover(title);
    expect(mockMouseEnter).toHaveBeenCalled();
    await userEvent.unhover(title);
    expect(mockMouseLeave).toHaveBeenCalled();
    await userEvent.click(title);
    expect(mockClick).toHaveBeenCalled();
  });
});
