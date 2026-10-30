import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DroppedDataFilterNote} from 'sentry/components/droppedData/droppedDataFilterNote';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

describe('DroppedDataFilterNote', () => {
  beforeEach(() => {
    PageFiltersStore.reset();
  });

  function setEnvironments(environments: string[]) {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({environments}));
  }

  it('renders nothing without a search or environment', () => {
    setEnvironments([]);
    const {container} = render(
      <DroppedDataFilterNote dataset={DiscoverDatasets.SPANS} hasUserQuery={false} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('notes the search when only a search is set', () => {
    setEnvironments([]);
    render(<DroppedDataFilterNote dataset={DiscoverDatasets.SPANS} hasUserQuery />);

    expect(
      screen.getByText('Dropped spans are not filtered by search')
    ).toBeInTheDocument();
  });

  it('notes the environment when only an environment is set', () => {
    setEnvironments(['production']);
    render(
      <DroppedDataFilterNote dataset={DiscoverDatasets.SPANS} hasUserQuery={false} />
    );

    expect(
      screen.getByText('Dropped spans are not filtered by environment')
    ).toBeInTheDocument();
  });

  it('notes both when a search and an environment are set', () => {
    setEnvironments(['production']);
    render(<DroppedDataFilterNote dataset={DiscoverDatasets.SPANS} hasUserQuery />);

    expect(
      screen.getByText('Dropped spans are not filtered by search or environment')
    ).toBeInTheDocument();
  });

  it.each([
    [DiscoverDatasets.OURLOGS, 'logs'],
    [DiscoverDatasets.TRACEMETRICS, 'metrics'],
    [DiscoverDatasets.ERRORS, 'errors'],
  ])('names the telemetry type for %s', (dataset, noun) => {
    setEnvironments([]);
    render(<DroppedDataFilterNote dataset={dataset} hasUserQuery />);

    expect(
      screen.getByText(`Dropped ${noun} are not filtered by search`)
    ).toBeInTheDocument();
  });
});
