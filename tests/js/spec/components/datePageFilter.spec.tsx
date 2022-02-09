import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import DatePageFilter from 'sentry/components/datePageFilter';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('DatePageFilter', function () {
  const {organization, router, routerContext} = initializeOrg({
    organization: undefined,
    project: undefined,
    projects: undefined,
    router: {
      location: {query: {}},
      params: {orgId: 'org-slug'},
    },
  });
  OrganizationStore.onUpdate(organization, {replace: true});
  PageFiltersStore.onInitializeUrlState(
    {
      projects: [],
      environments: [],
      datetime: {
        period: '7d',
        start: null,
        end: null,
        utc: null,
      },
    },
    new Set()
  );

  it('can change period', function () {
    mountWithTheme(
      <OrganizationContext.Provider value={organization}>
        <DatePageFilter />
      </OrganizationContext.Provider>,
      {
        context: routerContext,
      }
    );

    expect(screen.getByText('7D')).toBeInTheDocument();
    userEvent.click(screen.getByText('7D'));

    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({query: {statsPeriod: '7d'}})
    );
    expect(PageFiltersStore.getState()).toEqual({
      isReady: true,
      pinnedFilters: new Set(),
      selection: {
        datetime: {
          period: '7d',
          utc: null,
          start: null,
          end: null,
        },
        environments: [],
        projects: [],
      },
    });
  });

  it('can pin datetime', async function () {
    mountWithTheme(
      <OrganizationContext.Provider value={organization}>
        <DatePageFilter />
      </OrganizationContext.Provider>,
      {
        context: routerContext,
      }
    );

    // Confirm no filters are pinned
    expect(PageFiltersStore.getState()).toEqual(
      expect.objectContaining({
        pinnedFilters: new Set(),
      })
    );

    // Click the pin button
    const pinButton = screen.getByRole('button', {name: 'Pin'});
    userEvent.click(pinButton);

    await screen.findByRole('button', {name: 'Pin', pressed: true});

    expect(PageFiltersStore.getState()).toEqual(
      expect.objectContaining({
        pinnedFilters: new Set(['datetime']),
      })
    );
  });
});
