import {ReplayClickFrameFixture} from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SelectorList} from 'sentry/components/replays/breadcrumbs/selectorList';
import {hydrateBreadcrumbs} from 'sentry/utils/replays/hydrateBreadcrumbs';

describe('SelectorList', () => {
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
            attributes: {},
          },
        },
      }),
    ]);
    Reflect.deleteProperty(frame.data.node, 'attributes');

    render(<SelectorList frame={frame} />);

    expect(screen.getByText('button#save')).toBeInTheDocument();
  });
});
