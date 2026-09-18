import {ThemeFixture} from 'sentry-fixture/theme';

import type {VirtualizedTreeRenderedRow} from './virtualizedTreeUtils';
import {markRowAsClicked} from './virtualizedTreeUtils';

describe('markRowAsClicked', () => {
  const options = {rowHeight: 24, scrollTop: 0, theme: ThemeFixture()};

  it('updates the ghost row when the selected row is not rendered', () => {
    const ghostRow = document.createElement('div');

    markRowAsClicked(2, [], {...options, ghostRowRef: ghostRow});

    expect(ghostRow).toHaveStyle({opacity: '1', transform: 'translateY(48px)'});
  });

  it('hides the ghost row when the selected row is rendered', () => {
    const ghostRow = document.createElement('div');
    const renderedItems = [{key: 2}] as Array<VirtualizedTreeRenderedRow<unknown>>;

    markRowAsClicked(2, renderedItems, {...options, ghostRowRef: ghostRow});

    expect(ghostRow).toHaveStyle({opacity: '0'});
  });
});
