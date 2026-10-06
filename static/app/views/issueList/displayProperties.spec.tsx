import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {localStorageWrapper} from 'sentry/utils/localStorage';

import {
  DEFAULT_ISSUE_COLUMNS,
  IssueDisplayPropertiesProvider,
  useIssueDisplayProperties,
} from './displayProperties';

function renderPreferences(slug = 'org-slug') {
  return renderHookWithProviders(useIssueDisplayProperties, {
    organization: OrganizationFixture({slug}),
    additionalWrapper: IssueDisplayPropertiesProvider,
  });
}

describe('Issue display properties', () => {
  beforeEach(() => localStorageWrapper.clear());

  it('persists visibility across remounts and resets to defaults', async () => {
    const first = renderPreferences();
    expect(first.result.current.columns).toEqual(DEFAULT_ISSUE_COLUMNS);

    act(() => first.result.current.toggleColumn('graph'));
    await waitFor(() =>
      expect(
        JSON.parse(localStorageWrapper.getItem('issues-display-columns:org-slug')!)
      ).not.toContain('graph')
    );
    first.unmount();

    const second = renderPreferences();
    expect(second.result.current.columns).not.toContain('graph');
    act(() => second.result.current.resetColumns());
    expect(second.result.current.columns).toEqual(DEFAULT_ISSUE_COLUMNS);
    await waitFor(() =>
      expect(
        JSON.parse(localStorageWrapper.getItem('issues-display-columns:org-slug')!)
      ).toEqual(DEFAULT_ISSUE_COLUMNS)
    );
  });

  it('keeps organizations independent', async () => {
    const first = renderPreferences();
    act(() => first.result.current.toggleColumn('users'));
    await waitFor(() =>
      expect(
        localStorageWrapper.getItem('issues-display-columns:org-slug')
      ).not.toBeNull()
    );
    first.unmount();

    const second = renderPreferences('other-org');
    expect(second.result.current.columns).toEqual(DEFAULT_ISSUE_COLUMNS);
  });

  it.each(['{invalid', 'null', '{}', '"users"'])(
    'recovers default properties from invalid storage %s',
    stored => {
      localStorageWrapper.setItem('issues-display-columns:org-slug', stored);
      const {result} = renderPreferences();
      expect(result.current.columns).toEqual(DEFAULT_ISSUE_COLUMNS);
    }
  );

  it('ignores obsolete values and preserves canonical order without duplicates', () => {
    localStorageWrapper.setItem(
      'issues-display-columns:org-slug',
      JSON.stringify(['users', 'obsolete', 'event', 'users', null])
    );
    const {result} = renderPreferences();
    expect(result.current.columns).toEqual(['event', 'users']);
  });

  it('allows all optional properties to be hidden', () => {
    localStorageWrapper.setItem('issues-display-columns:org-slug', '[]');
    const {result} = renderPreferences();
    expect(result.current.columns).toEqual([]);
  });
});
