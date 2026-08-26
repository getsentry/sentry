import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {TransactionsList} from 'sentry/components/discover/transactionsList';
import {EventView} from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {OrganizationContext} from 'sentry/utils/organizationContext';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';

function WrapperComponent(props: any) {
  return (
    <OrganizationContext value={props.organization}>
      <MEPSettingProvider>
        <TransactionsList {...props} />
      </MEPSettingProvider>
    </OrganizationContext>
  );
}

describe('TransactionsList', () => {
  let api: any;
  let location: any;
  let context: any;
  let organization: any;
  let project: any;
  let eventView: any;
  let options: any;
  const handleDropdownChange = jest.fn();

  const initialize = (config = {}) => {
    context = initializeOrg(config);
    organization = context.organization;
    project = context.project;
  };

  beforeEach(() => {
    location = {
      pathname: '/',
      query: {},
    };
  });

  describe('Basic', () => {
    let generateLink: any;

    beforeEach(() => {
      initialize();
      eventView = EventView.fromSavedQuery({
        id: '',
        name: 'test query',
        version: 2,
        fields: ['transaction', 'count()'],
        projects: [project.id],
      });
      options = [
        {
          sort: {kind: 'asc', field: 'transaction'},
          value: 'name',
          label: 'Transactions',
        },
        {
          sort: {kind: 'desc', field: 'count'},
          value: 'count',
          label: 'Failing Transactions',
        },
      ];
      generateLink = {
        transaction: (org: any, row: any) => ({
          pathname: `/${org.slug}`,
          query: {
            ...location.query,
            transaction: row.transaction,
            count: row.count,
            'count()': row['count()'],
          },
        }),
      };

      const pageLinks =
        '<https://sentry.io/fake/previous>; rel="previous"; results="false"; cursor="0:0:1", ' +
        '<https://sentry.io/fake/next>; rel="next"; results="true"; cursor="0:20:0"';

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        headers: {Link: pageLinks},
        body: {
          meta: {transaction: 'string', count: 'number'},
          data: [
            {transaction: '/a', count: 100},
            {transaction: '/b', count: 1000},
          ],
        },
        match: [MockApiClient.matchQuery({sort: 'transaction'})],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        headers: {Link: pageLinks},
        body: {
          meta: {transaction: 'string', count: 'number'},
          data: [
            {transaction: '/b', count: 1000},
            {transaction: '/a', count: 100},
          ],
        },
        match: [MockApiClient.matchQuery({sort: '-count'})],
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        headers: {Link: pageLinks},
        body: {
          meta: {fields: {transaction: 'string', 'count()': 'number'}},
          data: [
            {transaction: '/a', 'count()': 100},
            {transaction: '/b', 'count()': 1000},
          ],
        },
        match: [MockApiClient.matchQuery({sort: 'transaction'})],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        headers: {Link: pageLinks},
        body: {
          meta: {fields: {transaction: 'string', 'count()': 'number'}},
          data: [
            {transaction: '/b', 'count()': 1000},
            {transaction: '/a', 'count()': 100},
          ],
        },
        match: [MockApiClient.matchQuery({sort: '-count'})],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-trends/`,
        headers: {Link: pageLinks},
        body: {
          meta: {
            transaction: 'string',
            trend_percentage: 'percentage',
            trend_difference: 'number',
          },
          data: [
            {transaction: '/a', 'trend_percentage()': 1.25, 'trend_difference()': 25},
            {transaction: '/b', 'trend_percentage()': 1.05, 'trend_difference()': 5},
          ],
        },
      });
    });

    it('renders basic UI components', async () => {
      render(
        <WrapperComponent
          api={api}
          location={location}
          organization={organization}
          eventView={eventView}
          selected={options[0]}
          options={options}
          handleDropdownChange={handleDropdownChange}
        />
      );

      expect(await screen.findByTestId('transactions-table')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: 'Open in Discover',
        })
      ).toBeInTheDocument();

      expect(screen.getAllByRole('columnheader')).toHaveLength(2);
      expect(
        screen.getByRole('button', {name: 'Filter Transactions'})
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Previous'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();

      const gridCells = screen.getAllByTestId('grid-cell');
      expect(gridCells.map(e => e.textContent)).toEqual(['/a', '100', '/b', '1,000']);
    });

    it('links "Open in Explore" to Explore > Traces when Discover is deprecated', async () => {
      initialize({
        organization: {
          features: [
            'discover-basic',
            'deprecate-discover',
            'discover-saved-queries-deprecation',
          ],
        },
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        body: {
          meta: {fields: {transaction: 'string', 'failure_count()': 'number'}},
          data: [{transaction: '/a', 'failure_count()': 1}],
        },
      });
      const spansEventView = EventView.fromSavedQuery({
        id: '',
        name: 'test query',
        version: 2,
        fields: ['transaction', 'failure_count()', 'epm()', 'p50()'],
        query: 'is_transaction:true release:"1.0" failure_count():>0',
        orderby: '-failure_count',
        projects: [Number(project.id)],
        dataset: DiscoverDatasets.SPANS,
      });

      render(
        <WrapperComponent
          api={api}
          location={location}
          organization={organization}
          eventView={spansEventView}
          selected={{sort: {kind: 'desc', field: 'failure_count'}, value: 'count'}}
          options={options}
          handleDropdownChange={handleDropdownChange}
        />
      );

      expect(await screen.findByTestId('transactions-table')).toBeInTheDocument();

      const link = screen.getByRole('button', {name: 'Open in Explore'});
      const href = link.getAttribute('href')!;
      expect(href).toContain('/organizations/org-slug/explore/traces/');
      expect(href).toContain('mode=aggregate');

      const query = new URLSearchParams(href.split('?')[1]);
      expect(query.get('groupBy')).toBe('transaction');
      // Aggregate HAVING conditions are dropped; row-level filters are kept.
      expect(query.get('query')).toBe('is_transaction:true release:1.0');
      // Columns stay in the list's field order; `p50()` gains its required
      // column argument for the spans dataset.
      expect(query.getAll('visualize')).toEqual([
        JSON.stringify({yAxes: ['failure_count()', 'epm()', 'p50(span.duration)']}),
      ]);
      // The list's sort is preserved via the aggregate sort param.
      expect(query.get('aggregateSort')).toBe('-failure_count()');
    });

    it('renders a trend view', async () => {
      options.push({
        sort: {kind: 'desc', field: 'trend_percentage()'},
        value: 'regression',
        label: 'Trending Regressions',
        trendType: 'regression',
      });
      render(
        <WrapperComponent
          api={api}
          location={location}
          organization={organization}
          trendView={eventView}
          selected={options[2]}
          options={options}
          handleDropdownChange={handleDropdownChange}
        />
      );

      expect(await screen.findByTestId('transactions-table')).toBeInTheDocument();

      const filterDropdown = screen.getByRole('button', {
        name: 'Filter Trending Regressions',
      });
      expect(filterDropdown).toBeInTheDocument();
      await userEvent.click(filterDropdown);

      const menuOptions = await screen.findAllByRole('option');
      expect(menuOptions.map(e => e.textContent)).toEqual([
        'Transactions',
        'Failing Transactions',
        'Trending Regressions',
      ]);

      expect(
        screen.queryByRole('button', {
          name: 'Open in Discover',
        })
      ).not.toBeInTheDocument();

      expect(screen.getByRole('button', {name: 'Previous'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();

      const gridCells = screen.getAllByTestId('grid-cell');
      expect(gridCells.map(e => e.textContent)).toEqual(
        expect.arrayContaining([
          '/a',
          '(no value)',
          '(no value)',
          '/b',
          '(no value)',
          '(no value)',
        ])
      );

      const tableHeadings = screen.getAllByRole('columnheader');
      expect(tableHeadings.map(e => e.textContent)).toEqual([
        'transaction',
        'percentage',
        'difference',
      ]);
    });

    it('renders default titles', async () => {
      render(
        <WrapperComponent
          api={api}
          location={location}
          organization={organization}
          eventView={eventView}
          selected={options[0]}
          options={options}
          handleDropdownChange={handleDropdownChange}
        />
      );

      expect(await screen.findByTestId('transactions-table')).toBeInTheDocument();

      const tableHeadings = screen.getAllByRole('columnheader');
      expect(tableHeadings.map(e => e.textContent)).toEqual(['transaction', 'count()']);
    });

    it('renders custom titles', async () => {
      render(
        <WrapperComponent
          api={api}
          location={location}
          organization={organization}
          eventView={eventView}
          selected={options[0]}
          options={options}
          handleDropdownChange={handleDropdownChange}
          titles={['foo', 'bar']}
        />
      );

      expect(await screen.findByTestId('transactions-table')).toBeInTheDocument();

      const tableHeadings = screen.getAllByRole('columnheader');
      expect(tableHeadings.map(e => e.textContent)).toEqual(['foo', 'bar']);
    });

    it('allows users to change the sort in the dropdown', async () => {
      const {rerender} = render(
        <WrapperComponent
          api={api}
          location={location}
          organization={organization}
          eventView={eventView}
          selected={options[0]}
          options={options}
          handleDropdownChange={handleDropdownChange}
        />
      );

      expect(await screen.findByTestId('transactions-table')).toBeInTheDocument();

      const gridCells = await screen.findAllByTestId('grid-cell');
      expect(gridCells.map(e => e.textContent)).toEqual(['/a', '100', '/b', '1,000']);

      const filterDropdown = screen.getByRole('button', {
        name: 'Filter Transactions',
      });
      expect(filterDropdown).toBeInTheDocument();
      await userEvent.click(filterDropdown);

      const menuOptions = await screen.findAllByRole('option');
      expect(menuOptions.map(e => e.textContent)).toEqual([
        'Transactions',
        'Failing Transactions',
      ]);

      // Failing transactions is 'count' as per the test options
      await userEvent.click(screen.getByRole('option', {name: 'Failing Transactions'}));

      // Simulate the dropdown change
      const newSelected = options.find((option: any) => option.value === 'count');
      rerender(
        <WrapperComponent
          selected={newSelected}
          api={api}
          location={location}
          organization={organization}
          eventView={eventView}
          options={options}
          handleDropdownChange={handleDropdownChange}
        />
      );

      await waitFor(() => {
        // now the sort is descending by count
        expect(
          screen.getAllByTestId('grid-cell').map(e => e.textContent?.trim())
        ).toEqual(['/b', '1,000', '/a', '100']);
      });
    });

    it('generates link for the transaction cell', async () => {
      render(
        <WrapperComponent
          api={api}
          location={location}
          organization={organization}
          eventView={eventView}
          selected={options[0]}
          options={options}
          handleDropdownChange={handleDropdownChange}
          generateLink={generateLink}
        />
      );

      expect(await screen.findByTestId('transactions-table')).toBeInTheDocument();

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAttribute(
        'href',
        '/org-slug?count%28%29=100&transaction=%2Fa'
      );
      expect(links[1]).toHaveAttribute(
        'href',
        '/org-slug?count%28%29=1000&transaction=%2Fb'
      );
    });

    it('handles forceLoading correctly', async () => {
      const component = render(
        <WrapperComponent
          api={null}
          location={location}
          organization={organization}
          eventView={eventView}
          selected={options[0]}
          options={options}
          handleDropdownChange={handleDropdownChange}
          forceLoading
        />
      );

      expect(await screen.findByTestId('loading-indicator')).toBeInTheDocument();

      component.rerender(
        <WrapperComponent
          api={null}
          location={location}
          organization={organization}
          eventView={eventView}
          selected={options[0]}
          options={options}
          handleDropdownChange={handleDropdownChange}
        />
      );

      expect(await screen.findByTestId('transactions-table')).toBeInTheDocument();
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

      const gridCells = screen.getAllByTestId('grid-cell');
      expect(gridCells.map(e => e.textContent)).toEqual(['/a', '100', '/b', '1,000']);
    });
  });
});
