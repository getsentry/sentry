import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FloatingTrigger} from './floatingTrigger';

describe('FloatingTrigger', () => {
  it('opens attribute breakdowns for the selection in one history entry when comparing', async () => {
    const {router} = render(
      <FloatingTrigger
        chartIndex={1}
        params={{
          selectionState: {
            actionMenuPosition: null,
            isActionMenuVisible: true,
            selection: {panelId: 'panel', range: [1000, 2000]},
          },
          setSelectionState: jest.fn(),
          clearSelection: jest.fn(),
        }}
      />,
      {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {mode: 'aggregate', query: 'span.op:db'},
          },
        },
      }
    );

    await userEvent.click(screen.getByText('Compare Attribute Breakdowns'));
    const comparedQuery = router.location.query;
    act(() => router.navigate(-1));

    expect(comparedQuery).toEqual({
      mode: 'samples',
      query: 'span.op:db',
      table: 'attribute_breakdowns',
      chartSelection: JSON.stringify({
        chartIndex: 1,
        range: [1000, 2000],
        panelId: 'panel',
      }),
    });
    expect(router.location.query).toEqual({mode: 'aggregate', query: 'span.op:db'});
  });
});
