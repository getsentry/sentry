import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SearchBar from 'sentry/components/events/searchBar';
import TagStore from 'sentry/stores/tagStore';
import type {Organization as TOrganization} from 'sentry/types/organization';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {datasetSupportedTags} from 'sentry/views/alerts/wizard/options';

const selectNthAutocompleteItem = async index => {
  await userEvent.click(screen.getByTestId('smart-search-input'), {delay: null});

  const items = await screen.findAllByTestId('search-autocomplete-item');

  const item = items.at(index);

  if (item === undefined) {
    throw new Error('Invalid item index');
  }

  await userEvent.click(item, {delay: null});
};

async function setQuery(query: any) {
  const input = screen.getByTestId('smart-search-input');
  await userEvent.click(input, {delay: null});
  await userEvent.paste(query, {delay: null});
}

describe('Events > SearchBar', function () {
  let tagValuesMock: any;
  let organization: TOrganization;
  let props: React.ComponentProps<typeof SearchBar>;

  beforeEach(function () {
    organization = OrganizationFixture();
    props = {
      organization,
      projectIds: [1, 2],
    };
    TagStore.reset();
    TagStore.loadTagsSuccess([
      {totalValues: 3, key: 'gpu', name: 'Gpu'},
      {totalValues: 3, key: 'mytag', name: 'Mytag'},
      {totalValues: 0, key: 'browser', name: 'Browser'},
    ]);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/is/values/',
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/error.handled/values/',
      method: 'GET',
      body: [],
    });

    tagValuesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/gpu/values/',
      body: [{totalValues: 2, name: 'Nvidia 1080ti'}],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('autocompletes measurement names', async function () {
    const initializationObj = initializeOrg({
      organization: {
        features: ['performance-view'],
      },
    });
    props.organization = initializationObj.organization;
    render(<SearchBar {...props} />);
    await setQuery('fcp');

    const autocomplete = await screen.findByTestId('search-autocomplete-item');
    expect(autocomplete).toBeInTheDocument();
    expect(autocomplete).toHaveTextContent('measurements.fcp');
  });

  it('autocompletes release semver queries', async function () {
    const initializationObj = initializeOrg();
    props.organization = initializationObj.organization;
    render(<SearchBar {...props} />);
    await setQuery('release.');

    const autocomplete = await screen.findAllByTestId('search-autocomplete-item');
    expect(autocomplete).toHaveLength(5);
    expect(autocomplete.at(0)).toHaveTextContent('release');
    expect(autocomplete.at(1)).toHaveTextContent('.build');
  });

  it('autocomplete has suggestions correctly', async function () {
    render(<SearchBar {...props} />);
    await setQuery('has:');

    const autocomplete = await screen.findAllByTestId('search-autocomplete-item');

    expect(autocomplete.at(0)).toHaveTextContent('has:');

    const itemIndex = autocomplete.findIndex(item => item.textContent === 'gpu');
    expect(itemIndex).toBeGreaterThan(-1);

    await selectNthAutocompleteItem(itemIndex);
    // the trailing space is important here as without it, autocomplete suggestions will
    // try to complete `has:gpu` thinking the token has not ended yet
    expect(screen.getByTestId('smart-search-input')).toHaveValue('has:gpu ');
  });

  it('searches and selects an event field value', async function () {
    render(<SearchBar {...props} />);
    await setQuery('gpu:');

    expect(tagValuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/tags/gpu/values/',
      expect.objectContaining({
        query: {project: ['1', '2'], statsPeriod: '14d', includeTransactions: '1'},
      })
    );

    const autocomplete = await screen.findAllByTestId('search-autocomplete-item');
    expect(autocomplete.at(2)).toHaveTextContent('Nvidia 1080ti');

    await selectNthAutocompleteItem(2);
    expect(screen.getByTestId('smart-search-input')).toHaveValue('gpu:"Nvidia 1080ti" ');
  });

  it('if `useFormWrapper` is false, async pressing enter when there are no dropdown items selected should blur and call `onSearch` callback', async function () {
    const onBlur = jest.fn();
    const onSearch = jest.fn();
    render(
      <SearchBar {...props} useFormWrapper={false} onSearch={onSearch} onBlur={onBlur} />
    );

    await setQuery('gpu:');

    expect(tagValuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/tags/gpu/values/',
      expect.objectContaining({
        query: {project: ['1', '2'], statsPeriod: '14d', includeTransactions: '1'},
      })
    );

    const autocomplete = await screen.findAllByTestId('search-autocomplete-item');
    expect(autocomplete.at(2)).toHaveTextContent('Nvidia 1080ti');
    await selectNthAutocompleteItem(2);

    await userEvent.type(screen.getByTestId('smart-search-input'), '{enter}');

    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('filters dropdown to accommodate for num characters left in query', async function () {
    render(<SearchBar {...props} maxQueryLength={5} />);

    await setQuery('g');

    const autocomplete = await screen.findAllByTestId('search-autocomplete-item');
    expect(autocomplete.at(0)).toHaveTextContent('g');
    expect(autocomplete).toHaveLength(2);
  });

  it('returns zero dropdown suggestions if out of characters', async function () {
    render(<SearchBar {...props} maxQueryLength={2} />);

    await setQuery('g');

    expect(await screen.findByText('No items found')).toBeInTheDocument();
  });

  it('sets maxLength property', function () {
    render(<SearchBar {...props} maxQueryLength={10} />);
    expect(screen.getByTestId('smart-search-input')).toHaveAttribute('maxLength', '10');
  });

  it('does not requery for event field values if query does not change', async function () {
    render(<SearchBar {...props} />);

    await setQuery('gpu:');

    // Click will fire "updateAutocompleteItems"
    await userEvent.click(screen.getByTestId('smart-search-input'), {delay: null});

    expect(tagValuesMock).toHaveBeenCalledTimes(1);
  });

  it('removes highlight when query is empty', async function () {
    render(<SearchBar {...props} />);

    await setQuery('gpu');

    const autocomplete = await screen.findByTestId('search-autocomplete-item');
    expect(autocomplete).toBeInTheDocument();
    expect(autocomplete).toHaveTextContent('gpu');

    // Should have nothing highlighted
    await userEvent.clear(screen.getByTestId('smart-search-input'));

    expect(await screen.findByText('Keys')).toBeInTheDocument();
  });

  it('ignores negation ("!") at the beginning of search term', async function () {
    render(<SearchBar {...props} />);

    await setQuery('!gp');

    const autocomplete = await screen.findByTestId('search-autocomplete-item');
    expect(autocomplete).toBeInTheDocument();
    expect(autocomplete).toHaveTextContent('gpu');
  });

  it('ignores wildcard ("*") at the beginning of tag value query', async function () {
    render(<SearchBar {...props} />);

    await setQuery('!gpu:*');

    expect(tagValuesMock).toHaveBeenCalledWith(
      '/organizations/org-slug/tags/gpu/values/',
      expect.objectContaining({
        query: {project: ['1', '2'], statsPeriod: '14d', includeTransactions: '1'},
      })
    );
    await selectNthAutocompleteItem(0);
    expect(screen.getByTestId('smart-search-input')).toHaveValue('!gpu:"Nvidia 1080ti" ');
  });

  it('stops searching after no values are returned', async function () {
    const emptyTagValuesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/browser/values/',
      body: [],
    });

    render(<SearchBar {...props} />);

    // Do 3 searches, the first will find nothing, so no more requests should be made
    await setQuery('browser:Nothing');
    expect(await screen.findByText('No items found')).toBeInTheDocument();
    expect(emptyTagValuesMock).toHaveBeenCalled();
    emptyTagValuesMock.mockClear();

    // Add E character
    await setQuery('E');

    await setQuery('Els');

    // No Additional calls
    expect(emptyTagValuesMock).not.toHaveBeenCalled();
  });

  it('continues searching after no values if query changes', async function () {
    const emptyTagValuesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/browser/values/',
      body: [],
    });

    render(<SearchBar {...props} />);

    await setQuery('browser:Nothing');
    expect(emptyTagValuesMock).toHaveBeenCalled();

    emptyTagValuesMock.mockClear();
    await userEvent.clear(screen.getByTestId('smart-search-input'));

    await setQuery('browser:Something');

    expect(emptyTagValuesMock).toHaveBeenCalled();
  });

  it('searches for custom measurements', async function () {
    const initializationObj = initializeOrg({
      organization: {
        features: ['performance-view'],
      },
    });
    props.organization = initializationObj.organization;
    render(
      <SearchBar
        {...props}
        customMeasurements={{
          'measurements.custom.ratio': {
            key: 'measurements.custom.ratio',
            name: 'measurements.custom.ratio',
            functions: [],
            fieldType: 'test',
            unit: '',
          },
        }}
      />
    );
    await userEvent.type(screen.getByRole('textbox'), 'custom');
    expect(await screen.findByText('measurements')).toBeInTheDocument();
    expect(screen.getByText(/\.ratio/)).toBeInTheDocument();
  });

  it('raises Invalid file size when parsed filter unit is not a valid size unit', async () => {
    render(
      <SearchBar
        {...props}
        customMeasurements={{
          'measurements.custom.kibibyte': {
            key: 'measurements.custom.kibibyte',
            name: 'measurements.custom.kibibyte',
            functions: [],
            fieldType: 'size',
            unit: '',
          },
        }}
      />
    );

    const textbox = screen.getByRole('textbox');
    await userEvent.click(textbox);
    await userEvent.type(textbox, 'measurements.custom.kibibyte:10ms ');
    await userEvent.keyboard('{arrowleft}');

    expect(
      screen.getByText(
        'Invalid file size. Expected number followed by file size unit suffix'
      )
    ).toBeInTheDocument();
  });

  it('raises Invalid duration when parsed filter unit is not a valid duration unit', async () => {
    render(
      <SearchBar
        {...props}
        customMeasurements={{
          'measurements.custom.minute': {
            key: 'measurements.custom.minute',
            name: 'measurements.custom.minute',
            functions: [],
            fieldType: 'duration',
            unit: '',
          },
        }}
      />
    );

    const textbox = screen.getByRole('textbox');
    await userEvent.click(textbox);
    await userEvent.type(textbox, 'measurements.custom.minute:10kb ');
    await userEvent.keyboard('{arrowleft}');

    expect(
      screen.getByText(
        'Invalid duration. Expected number followed by duration unit suffix'
      )
    ).toBeInTheDocument();
  });

  it('is query works for metric alert search bar', async function () {
    const OrganizationIs = OrganizationFixture();
    render(
      <SearchBar
        {...props}
        supportedTags={datasetSupportedTags(Dataset.ERRORS, OrganizationIs)}
      />
    );
    await setQuery('is:');

    const autocomplete = await screen.findAllByTestId('search-autocomplete-item');
    expect(autocomplete.at(0)).toHaveTextContent('is:');
  });

  it('handled query works for metric alert search bar', async function () {
    const OrganizationIs = OrganizationFixture();
    render(
      <SearchBar
        {...props}
        supportedTags={datasetSupportedTags(Dataset.ERRORS, OrganizationIs)}
      />
    );
    await setQuery('error.handled:');

    const autocomplete = await screen.findAllByTestId('search-autocomplete-item');
    expect(autocomplete.at(0)).toHaveTextContent('handled:');
  });
});
