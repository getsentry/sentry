import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  RenderResult,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import TransactionsList from 'sentry/components/discover/transactionsList';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {OrganizationContext} from 'sentry/views/organizationContext';

function WrapperComponent(props) {
  return (
    <OrganizationContext.Provider value={props.organization}>
      <MEPSettingProvider>
        <TransactionsList {...props} />
      </MEPSettingProvider>
    </OrganizationContext.Provider>
  );
}

describe('TransactionsList', function () {
  let api;
  let location;
  let context;
  let organization;
  let project;
  let eventView;
  let options;
  let handleDropdownChange;

  const initialize = (config = {}) => {
    context = initializeOrg(config);
    organization = context.organization;
    project = context.project;
  };

  beforeEach(function () {
    location = {
      pathname: '/',
      query: {},
    };
    handleDropdownChange = () => {
      //
    };
  });

  describe('Basic', function () {
    let generateLink, routerContext;

    beforeEach(function () {
      routerContext = RouterContextFixture([{organization}]);
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
          label: t('Transactions'),
        },
        {
          sort: {kind: 'desc', field: 'count'},
          value: 'count',
          label: t('Failing Transactions'),
        },
      ];
      generateLink = {
        transaction: (org, row, query) => ({
          pathname: `/${org.slug}`,
          query: {
            ...query,
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

    it('renders basic UI components', async function () {
      render(
        <WrapperComponent
          api={api}
          location={location}
          organization={organization}
          eventView={eventView}
          selected={options[0]}
          options={options}
          handleDropdownChange={handleDropdownChange}
        />,
        {
          context: routerContext,
        }
      );

      expect(await screen.findByTestId('transactions-table')).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: 'Open in Discover',
        })
      ).toBeInTheDocument();

      expect(screen.getAllByTestId('table-header')).toHaveLength(2);
      expect(
        screen.getByRole('button', {name: 'Filter Transactions'})
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Previous'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Next'})).toBeInTheDocument();

      const gridCells = screen.getAllByTestId('grid-cell');
      expect(gridCells.map(e => e.textContent)).toEqual(['/a', '100', '/b', '1000']);
    });

    it('renders a trend view', async function () {
      options.push({
        sort: {kind: 'desc', field: 'trend_percentage()'},
        value: 'regression',
        label: t('Trending Regressions'),
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
        />,
        {
          context: routerContext,
        }
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

      const tableHeadings = screen.getAllByTestId('table-header');
      expect(tableHeadings.map(e => e.textContent)).toEqual([
        'transaction',
        'percentage',
        'difference',
      ]);
    });

    it('renders default titles', async function () {
      render(
        <WrapperComponent
          api={api}
          location={location}
          organization={organization}
          eventView={eventView}
          selected={options[0]}
          options={options}
          handleDropdownChange={handleDropdownChange}
        />,
        {
          context: routerContext,
        }
      );

      expect(await screen.findByTestId('transactions-table')).toBeInTheDocument();

      const tableHeadings = screen.getAllByTestId('table-header');
      expect(tableHeadings.map(e => e.textContent)).toEqual(['transaction', 'count()']);
    });

    it('renders custom titles', async function () {
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
        />,
        {
          context: routerContext,
        }
      );

      expect(await screen.findByTestId('transactions-table')).toBeInTheDocument();

      const tableHeadings = screen.getAllByTestId('table-header');
      expect(tableHeadings.map(e => e.textContent)).toEqual(['foo', 'bar']);
    });

    it('allows users to change the sort in the dropdown', async function () {
      let component: RenderResult | null = null;

      const handleDropdown = value => {
        const selected = options.find(option => option.value === value);
        if (selected && component) {
          component.rerender(
            <WrapperComponent
              selected={selected}
              api={api}
              location={location}
              organization={organization}
              eventView={eventView}
              options={options}
            />
          );
        }
      };

      component = render(
        <WrapperComponent
          api={api}
          location={location}
          organization={organization}
          eventView={eventView}
          selected={options[0]}
          options={options}
          handleDropdownChange={handleDropdown}
        />,
        {
          context: routerContext,
        }
      );

      expect(await screen.findByTestId('transactions-table')).toBeInTheDocument();

      const gridCells = screen.getAllByTestId('grid-cell');
      expect(gridCells.map(e => e.textContent)).toEqual(['/a', '100', '/b', '1000']);

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

      await userEvent.click(menuOptions[1]); // Failing transactions is 'count' as per the test options

      waitFor(() => {
        // now the sort is descending by count
        expect(screen.getAllByTestId('grid-cell').map(e => e.textContent)).toEqual([
          '/a',
          '100',
          '/b',
          '1000',
        ]);
      });
    });

    it('generates link for the transaction cell', async function () {
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
        />,
        {context: routerContext}
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

    it('handles forceLoading correctly', async function () {
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
        />,
        {context: routerContext}
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
      expect(gridCells.map(e => e.textContent)).toEqual(['/a', '100', '/b', '1000']);
    });
  });
});
