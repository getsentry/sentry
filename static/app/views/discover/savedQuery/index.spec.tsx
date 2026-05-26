import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {NewQuery, Organization, SavedQuery} from 'sentry/types/organization';
import {EventView} from 'sentry/utils/discover/eventView';
import {DisplayModes} from 'sentry/utils/discover/types';
import {getAllViews} from 'sentry/views/discover/results/data';
import SavedQueryButtonGroup from 'sentry/views/discover/savedQuery';

function mount(
  location: ReturnType<typeof LocationFixture>,
  organization: Organization,
  eventView: EventView,
  savedQuery: SavedQuery | NewQuery | undefined,
  yAxis: string[],
  disabled = false,
  setSavedQuery = jest.fn()
) {
  return render(
    <SavedQueryButtonGroup
      location={location}
      organization={organization}
      eventView={eventView}
      savedQuery={savedQuery as SavedQuery}
      disabled={disabled}
      updateCallback={() => {}}
      yAxis={yAxis}
      queryDataLoading={false}
      setSavedQuery={setSavedQuery}
      setHomepageQuery={jest.fn()}
    />
  );
}

describe('Discover > SaveQueryButtonGroup', () => {
  let organization: Organization;
  let errorsView: EventView;
  let errorsQuery: NewQuery;
  const location = LocationFixture({
    pathname: '/organization/eventsv2/',
    query: {},
  });
  const yAxis = ['count()', 'failure_count()'];

  beforeEach(() => {
    organization = OrganizationFixture({
      features: ['discover-query', 'dashboards-edit'],
    });

    errorsQuery = {
      ...getAllViews(organization).find(view => view.name === 'Errors by Title')!,
      yAxis: ['count()'],
      display: DisplayModes.DEFAULT,
    };
    errorsView = EventView.fromSavedQuery(errorsQuery);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders Saved Queries button', () => {
    mount(location, organization, errorsView, undefined, yAxis);

    expect(screen.getByRole('button', {name: /saved queries/i})).toBeInTheDocument();
  });

  it('renders Saved Queries link with disabled state when disabled prop is used', () => {
    mount(location, organization, errorsView, undefined, yAxis, true);

    expect(screen.getByRole('button', {name: /saved queries/i})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('does not render save as, create alert, or context menu buttons', () => {
    mount(location, organization, errorsView, undefined, yAxis);

    expect(screen.queryByRole('button', {name: /save as/i})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /create alert/i})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: /discover context menu/i})
    ).not.toBeInTheDocument();
  });
});
