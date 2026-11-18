import {
  ReplayClickFrameFixture,
  ReplayNavFrameFixture,
} from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {
  act,
  renderHookWithProviders as renderHook,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {hydrateBreadcrumbs} from 'sentry/utils/replays/hydrateBreadcrumbs';

import {useBreadcrumbFilters} from './useBreadcrumbFilters';

const timestamp = new Date('2024-01-01T00:00:00Z');
const frames = hydrateBreadcrumbs(ReplayRecordFixture({started_at: timestamp}), [
  ReplayClickFrameFixture({timestamp, message: 'button'}),
  ReplayClickFrameFixture({timestamp, message: 'a'}),
  ReplayNavFrameFixture({timestamp}),
]);

function renderWithType(f_b_type: string[]) {
  return renderHook(useBreadcrumbFilters, {
    initialProps: {frames},
    initialRouterConfig: {location: {pathname: '/', query: {f_b_type}}},
  });
}

describe('useBreadcrumbFilters', () => {
  it('filters by a known type', () => {
    const {result} = renderWithType(['click']);
    expect(result.current.type).toEqual(['click']);
    expect(result.current.items).toHaveLength(2);
  });

  it('ignores unknown types', () => {
    const {result} = renderWithType(['click', 'ui.click', 'bogus', '', 'toString']);
    expect(result.current.type).toEqual(['click']);
    expect(result.current.items).toHaveLength(2);
    expect(result.current.getBreadcrumbTypes()).toEqual([
      {value: 'click', label: 'User Click'},
      {value: 'nav', label: 'Navigation'},
    ]);
  });

  it('shows every breadcrumb when no type is valid', () => {
    const {result} = renderWithType(['ui.click', 'navigation']);
    expect(result.current.type).toEqual([]);
    expect(result.current.items).toHaveLength(3);
  });

  it('clears both the type and search filters', async () => {
    const {result, router} = renderHook(useBreadcrumbFilters, {
      initialProps: {frames},
      initialRouterConfig: {
        location: {pathname: '/', query: {f_b_type: ['click'], f_b_search: 'nope'}},
      },
    });
    expect(result.current.items).toHaveLength(0);

    act(() => result.current.clearAllFilters());

    await waitFor(() => expect(router.location.query).toEqual({}));
    expect(result.current.items).toHaveLength(3);
  });
});
