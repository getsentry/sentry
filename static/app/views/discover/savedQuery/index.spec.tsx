import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {NewQuery, Organization, SavedQuery} from 'sentry/types/organization';
import {EventView} from 'sentry/utils/discover/eventView';
import {DisplayModes} from 'sentry/utils/discover/types';
import {getDiscoverQueriesUrl} from 'sentry/utils/discover/urls';
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

  it('renders the Saved Queries button linking to the saved queries page', () => {
    mount(location, organization, errorsView, undefined, yAxis);

    const button = screen.getByTestId('discover2-savedquery-button-view-saved');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Saved Queries');
    expect(button).toHaveAttribute('href', getDiscoverQueriesUrl(organization));
  });

  it('disables the Saved Queries button when disabled', () => {
    mount(location, organization, errorsView, undefined, yAxis, true);

    expect(screen.getByTestId('discover2-savedquery-button-view-saved')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('disables the Saved Queries button without the discover-query feature', () => {
    const orgWithoutFeature = OrganizationFixture({features: []});

    mount(location, orgWithoutFeature, errorsView, undefined, yAxis);

    expect(screen.getByTestId('discover2-savedquery-button-view-saved')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });
});
