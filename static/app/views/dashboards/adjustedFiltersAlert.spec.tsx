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
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture(), true, {});

    const {container} = render(<AdjustedFiltersAlert hasUnsavedChanges={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('explains every adjustment and prompts to save', () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture(), true, {
      projects: {reason: PageFilterAdjustmentReason.INVALID_PROJECTS},
      datetime: {reason: PageFilterAdjustmentReason.MAX_PICKABLE_DAYS, days: 30},
    });

    render(<AdjustedFiltersAlert hasUnsavedChanges />);

    // Every explanation reads on its own line, with the prompt to save last.
    expect(
      screen.getByText(
        "Your project selection changed because it included projects you don't have access to."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your date range changed to 30 days, the longest range your organization can query.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Save this dashboard to keep the new selection.')
    ).toBeInTheDocument();
  });

  it('stops explaining an adjustment once the user changes that filter', () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [-1]}), true, {
      projects: {reason: PageFilterAdjustmentReason.NO_MEMBER_PROJECTS},
    });

    const message = /Your project selection changed to All Projects/;

    const {rerender} = render(<AdjustedFiltersAlert hasUnsavedChanges />);
    expect(screen.getByText(message)).toBeInTheDocument();

    act(() => PageFiltersStore.updateProjects([2], null));
    rerender(<AdjustedFiltersAlert hasUnsavedChanges />);

    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });
});
