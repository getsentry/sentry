import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import {Client} from 'app/api';
import TransactionsList from 'app/components/discover/transactionsList';
import {t} from 'app/locale';
import EventView from 'app/utils/discover/eventView';

describe('TransactionsList', function () {
  let wrapper;
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
    api = new Client();
    location = {
      pathname: '/',
      query: {},
    };
    handleDropdownChange = value => {
      const selected = options.find(option => option.value === value);
      if (selected) {
        wrapper.setProps({selected});
      }
    };
  });

  describe('Basic', function () {
    let generateLink;

    beforeEach(function () {
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
          },
        }),
      };

      MockApiClient.addMockResponse(
        {
          url: `/organizations/${organization.slug}/eventsv2/`,
          body: {
            meta: {transaction: 'string', count: 'number'},
            data: [
              {transaction: '/a', count: 100},
              {transaction: '/b', count: 1000},
            ],
          },
        },
        {
          predicate: (_, opts) => opts?.query?.sort === 'transaction',
        }
      );
      MockApiClient.addMockResponse(
        {
          url: `/organizations/${organization.slug}/eventsv2/`,
          body: {
            meta: {transaction: 'string', count: 'number'},
            data: [
              {transaction: '/b', count: 1000},
              {transaction: '/a', count: 100},
            ],
          },
        },
        {
          predicate: (_, opts) => opts?.query?.sort === '-count',
        }
      );
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events-trends/`,
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

    const selectDropdownOption = (w, selection) => {
      w.find('DropdownControl').first().simulate('click');
      w.find(`DropdownItem[data-test-id="option-${selection}"] span`).simulate('click');
    };

    it('renders basic UI components', async function () {
      wrapper = mountWithTheme(
        <TransactionsList
          api={api}
          location={location}
          organization={organization}
          eventView={eventView}
          selected={options[0]}
          options={options}
          handleDropdownChange={handleDropdownChange}
        />
      );

      await tick();
      wrapper.update();

      expect(wrapper.find('DropdownControl')).toHaveLength(1);
      expect(wrapper.find('DropdownItem')).toHaveLength(2);
      expect(wrapper.find('DiscoverButton')).toHaveLength(1);
      expect(wrapper.find('Pagination')).toHaveLength(1);
      expect(wrapper.find('PanelTable')).toHaveLength(1);
      // 2 for the transaction names
      expect(wrapper.find('GridCell')).toHaveLength(2);
      // 2 for the counts
      expect(wrapper.find('GridCellNumber')).toHaveLength(2);
    });

    it('renders a trend view', async function () {
      options.push({
        sort: {kind: 'desc', field: 'trend_percentage()'},
        value: 'regression',
        label: t('Trending Regressions'),
        trendType: 'regression',
      });
      wrapper = mountWithTheme(
        <TransactionsList
          api={api}
          location={location}
          organization={organization}
          trendView={eventView}
          selected={options[2]}
          options={options}
          handleDropdownChange={handleDropdownChange}
        />
      );

      await tick();
      wrapper.update();

      expect(wrapper.find('DropdownControl')).toHaveLength(1);
      expect(wrapper.find('DropdownItem')).toHaveLength(3);
      expect(wrapper.find('DiscoverButton')).toHaveLength(0);
      expect(wrapper.find('Pagination')).toHaveLength(1);
      expect(wrapper.find('PanelTable')).toHaveLength(1);
      // trend_percentage and transaction name
      expect(wrapper.find('GridCell')).toHaveLength(4);
      // trend_difference
      expect(wrapper.find('GridCellNumber')).toHaveLength(2);
    });

    it('renders default titles', async function () {
      wrapper = mountWithTheme(
        <TransactionsList
          api={api}
          location={location}
          organization={organization}
          eventView={eventView}
          selected={options[0]}
          options={options}
          handleDropdownChange={handleDropdownChange}
        />
      );

      await tick();
      wrapper.update();

      const headers = wrapper.find('SortLink');
      expect(headers).toHaveLength(2);
      expect(headers.first().text()).toEqual('transaction');
      expect(headers.last().text()).toEqual('count()');
    });

    it('renders custom titles', async function () {
      wrapper = mountWithTheme(
        <TransactionsList
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

      await tick();
      wrapper.update();

      const headers = wrapper.find('SortLink');
      expect(headers).toHaveLength(2);
      expect(headers.first().text()).toEqual('foo');
      expect(headers.last().text()).toEqual('bar');
    });

    it('allows users to change the sort in the dropdown', async function () {
      wrapper = mountWithTheme(
        <TransactionsList
          api={api}
          location={location}
          organization={organization}
          eventView={eventView}
          selected={options[0]}
          options={options}
          handleDropdownChange={handleDropdownChange}
        />
      );

      await tick();
      wrapper.update();

      // initial sort is ascending by transaction name
      expect(wrapper.find('GridCell').first().text()).toEqual('/a');
      expect(wrapper.find('GridCellNumber').first().text()).toEqual('100');
      expect(wrapper.find('GridCell').last().text()).toEqual('/b');
      expect(wrapper.find('GridCellNumber').last().text()).toEqual('1000');

      selectDropdownOption(wrapper, 'count');
      await tick();
      wrapper.update();

      // now the sort is descending by count
      expect(wrapper.find('GridCell').first().text()).toEqual('/b');
      expect(wrapper.find('GridCellNumber').first().text()).toEqual('1000');
      expect(wrapper.find('GridCell').last().text()).toEqual('/a');
      expect(wrapper.find('GridCellNumber').last().text()).toEqual('100');
    });

    it('generates link for the transaction cell', async function () {
      wrapper = mountWithTheme(
        <TransactionsList
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

      await tick();
      wrapper.update();

      const links = wrapper.find('Link');
      expect(links).toHaveLength(2);
      expect(links.first().props().to).toEqual(
        expect.objectContaining({
          pathname: `/${organization.slug}`,
          query: {
            transaction: '/a',
            count: 100,
          },
        })
      );
      expect(links.last().props().to).toEqual(
        expect.objectContaining({
          pathname: `/${organization.slug}`,
          query: {
            transaction: '/b',
            count: 1000,
          },
        })
      );
    });

    it('handles forceLoading correctly', async function () {
      wrapper = mountWithTheme(
        <TransactionsList
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

      expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
      wrapper.setProps({api, forceLoading: false});

      await tick();
      wrapper.update();

      expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
      expect(wrapper.find('DropdownControl')).toHaveLength(1);
      expect(wrapper.find('DropdownItem')).toHaveLength(2);
      expect(wrapper.find('DiscoverButton')).toHaveLength(1);
      expect(wrapper.find('Pagination')).toHaveLength(1);
      expect(wrapper.find('PanelTable')).toHaveLength(1);
      // 2 for the transaction names
      expect(wrapper.find('GridCell')).toHaveLength(2);
      // 2 for the counts
      expect(wrapper.find('GridCellNumber')).toHaveLength(2);
    });
  });

  describe('Baseline', function () {
    beforeEach(function () {
      initialize({
        organization: {features: 'transaction-comparison'},
      });
      eventView = EventView.fromSavedQuery({
        id: '',
        name: 'baseline query',
        version: 2,
        fields: ['id', 'transaction.duration'],
        projects: [project.id],
      });
      options = [
        {
          sort: {kind: 'desc', field: 'transaction.duration'},
          value: 'slow',
          label: t('Slow Transactions'),
        },
      ];

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/eventsv2/`,
        body: {
          meta: {id: 'string', 'transaction.duration': 'duration'},
          data: [
            {id: 'a', 'transaction.duration': 123},
            {id: 'c', 'transaction.duration': 12345},
          ],
        },
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/event-baseline/`,
        body: {
          'transaction.duration': 1234,
        },
      });
    });

    it('renders baseline comparison correctly', async function () {
      wrapper = mountWithTheme(
        <TransactionsList
          api={api}
          location={location}
          organization={organization}
          eventView={eventView}
          selected={options[0]}
          options={options}
          handleDropdownChange={handleDropdownChange}
          baseline="/"
        />
      );

      await tick();
      wrapper.update();

      const titles = ['id', 'transaction.duration', 'Compared to Baseline'];
      const headers = wrapper.find('SortLink');
      expect(headers).toHaveLength(titles.length);
      headers.forEach((header, i) => {
        expect(header.text()).toEqual(titles[i]);
      });

      const cellTexts = ['1.11 seconds faster', '11.11 seconds slower'];
      const cells = wrapper.find('BodyCellContainer[data-test-id="baseline-cell"]');
      expect(cells).toHaveLength(2);
      cells.forEach((cell, i) => {
        expect(cell.text()).toEqual(cellTexts[i]);
      });
    });

    it('renders View All Events button when provided with handler', async function () {
      wrapper = mountWithTheme(
        <TransactionsList
          api={api}
          location={location}
          organization={organization}
          eventView={eventView}
          selected={options[0]}
          options={options}
          handleDropdownChange={handleDropdownChange}
          baseline="/"
          handleOpenAllEventsClick={() => {}}
        />
      );

      await tick();
      wrapper.update();

      expect(wrapper.find('Button').last().find('span').children().html()).toEqual(
        'View All Events'
      );
    });
  });
});
