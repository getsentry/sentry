import {ReplayClickFrameFixture} from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SelectorList} from 'sentry/components/replays/breadcrumbs/selectorList';
import {hydrateBreadcrumbs} from 'sentry/utils/replays/hydrateBreadcrumbs';
import type {ClickFrame} from 'sentry/utils/replays/types';

describe('SelectorList', () => {
  it('links annotated components to replay search', () => {
    const [frame] = hydrateBreadcrumbs(ReplayRecordFixture(), [
      ReplayClickFrameFixture({
        timestamp: new Date('2024/06/21'),
        message: 'button > SaveButton',
        data: {
          node: {
            id: 1,
            tagName: 'button',
            textContent: 'Save',
            attributes: {'data-sentry-component': 'SaveButton'},
          },
        },
      }),
    ]);
    render(<SelectorList frame={frame as ClickFrame} />);

    expect(screen.getByRole('link', {name: 'SaveButton'})).toBeInTheDocument();
  });

  it('renders malformed click breadcrumbs without attributes', () => {
    const [frame] = hydrateBreadcrumbs(ReplayRecordFixture(), [
      ReplayClickFrameFixture({
        timestamp: new Date('2024/06/21'),
        message: 'button#save',
        data: {
          node: {
            id: 1,
            tagName: 'button',
            textContent: 'Save',
            // `attributes` is intentionally omitted to represent a malformed breadcrumb.
          } as any,
        },
      }),
    ]);
    render(<SelectorList frame={frame as ClickFrame} />);

    expect(screen.getByText('button#save')).toBeInTheDocument();
  });
});
