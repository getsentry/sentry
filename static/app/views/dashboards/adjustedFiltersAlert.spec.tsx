import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFilterAdjustmentReason} from 'sentry/components/pageFilters/adjustments';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {AdjustedFiltersAlert} from 'sentry/views/dashboards/adjustedFiltersAlert';

describe('AdjustedFiltersAlert', () => {
  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('renders nothing when the selection was not adjusted', () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture(), true, []);

    const {container} = render(<AdjustedFiltersAlert hasUnsavedChanges={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('explains why the selection fell back to All Projects', () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [-1]}), true, [
      {filter: 'projects', reason: PageFilterAdjustmentReason.NO_MEMBER_PROJECTS},
    ]);

    render(<AdjustedFiltersAlert hasUnsavedChanges={false} />);

    expect(
      screen.getByText(
        "Your project selection changed to All Projects because you're not a member of any project in this organization."
      )
    ).toBeInTheDocument();
  });

  it('tells the user to save when the adjustment created unsaved changes', () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [-1]}), true, [
      {filter: 'projects', reason: PageFilterAdjustmentReason.NO_MEMBER_PROJECTS},
    ]);

    render(<AdjustedFiltersAlert hasUnsavedChanges />);

    expect(
      screen.getByText(/Save this dashboard to keep the new selection\./)
    ).toBeInTheDocument();
  });

  it('does not prompt to save when there are no unsaved changes', () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [-1]}), true, [
      {filter: 'projects', reason: PageFilterAdjustmentReason.NO_MEMBER_PROJECTS},
    ]);

    render(<AdjustedFiltersAlert hasUnsavedChanges={false} />);

    expect(
      screen.queryByText(/Save this dashboard to keep the new selection\./)
    ).not.toBeInTheDocument();
  });

  it('lists every adjustment made to the selection', () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture(), true, [
      {filter: 'projects', reason: PageFilterAdjustmentReason.INVALID_PROJECTS},
      {
        filter: 'datetime',
        reason: PageFilterAdjustmentReason.MAX_PICKABLE_DAYS,
        days: 30,
      },
    ]);

    render(<AdjustedFiltersAlert hasUnsavedChanges />);

    // Every explanation reads as one paragraph rather than one line each.
    expect(
      screen.getByText(
        "Your project selection changed because it included projects you don't have access to. " +
          'Your date range changed to 30 days, the longest range your organization can query. ' +
          'Save this dashboard to keep the new selection.'
      )
    ).toBeInTheDocument();
  });

  it('names the project that was auto-selected', () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [1]}), true, [
      {
        filter: 'projects',
        reason: PageFilterAdjustmentReason.SINGLE_PROJECT_AUTO_SELECTED,
        projectSlug: 'the-only-project',
      },
    ]);

    render(<AdjustedFiltersAlert hasUnsavedChanges={false} />);

    expect(
      screen.getByText(
        'Your project selection changed to the-only-project, the only project in this organization.'
      )
    ).toBeInTheDocument();
  });

  it('stops explaining an adjustment once the user changes that filter', () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [-1]}), true, [
      {filter: 'projects', reason: PageFilterAdjustmentReason.NO_MEMBER_PROJECTS},
    ]);

    const message = /Your project selection changed to All Projects/;

    const {rerender} = render(<AdjustedFiltersAlert hasUnsavedChanges />);
    expect(screen.getByText(message)).toBeInTheDocument();

    act(() => PageFiltersStore.updateProjects([2], null));
    rerender(<AdjustedFiltersAlert hasUnsavedChanges />);

    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });
});
