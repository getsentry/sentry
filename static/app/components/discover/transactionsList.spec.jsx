import {act} from 'react-dom/test-utils';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {triggerPress} from 'sentry-test/utils';

import {Client} from 'sentry/api';
import TransactionsList from 'sentry/components/discover/transactionsList';
import {t} from 'sentry/locale';
import EventView from 'sentry/utils/discover/eventView';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {OrganizationContext} from 'sentry/views/organizationContext';

const WrapperComponent = props => {
  return (
    <OrganizationContext.Provider value={props.organization}>
      <MEPSettingProvider _isMEPEnabled={false}>
        <TransactionsList {...props} />
      </MEPSettingProvider>
    </OrganizationContext.Provider>
  );
};

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
            'count()': row['count()'],
          },
        }),
      };

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/eventsv2/`,
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
        url: `/organizations/${organization.slug}/eventsv2/`,
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

    const openDropdown = async w => {
      await act(async () => {
        triggerPress(w.find('CompactSelect Button'));
        await tick();
        w.update();
      });
    };

    const selectDropdownOption = async (w, selection) => {
      await openDropdown(w);
      await act(async () => {
        triggerPress(w.find(`MenuItemWrap[value="${selection}"]`));
        await tick();
        w.update();
      });
    };

    describe('with eventsv2', function () {
      it('renders basic UI components', async function () {
        wrapper = mountWithTheme(
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

        await tick();
        wrapper.update();

        expect(wrapper.find('CompactSelect')).toHaveLength(1);
        await openDropdown(wrapper);
        expect(wrapper.find('MenuItemWrap')).toHaveLength(2);
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

        await tick();
        wrapper.update();

        expect(wrapper.find('CompactSelect')).toHaveLength(1);
        await openDropdown(wrapper);
        expect(wrapper.find('MenuItemWrap')).toHaveLength(3);
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

        await tick();
        wrapper.update();

        const headers = wrapper.find('SortLink');
        expect(headers).toHaveLength(2);
        expect(headers.first().text()).toEqual('transaction');
        expect(headers.last().text()).toEqual('count()');
      });

      it('renders custom titles', async function () {
        wrapper = mountWithTheme(
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

        await tick();
        wrapper.update();

        const headers = wrapper.find('SortLink');
        expect(headers).toHaveLength(2);
        expect(headers.first().text()).toEqual('foo');
        expect(headers.last().text()).toEqual('bar');
      });

      it('allows users to change the sort in the dropdown', async function () {
        wrapper = mountWithTheme(
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

        await tick();
        wrapper.update();

        // initial sort is ascending by transaction name
        expect(wrapper.find('GridCell').first().text()).toEqual('/a');
        expect(wrapper.find('GridCellNumber').first().text()).toEqual('100');
        expect(wrapper.find('GridCell').last().text()).toEqual('/b');
        expect(wrapper.find('GridCellNumber').last().text()).toEqual('1000');

        await selectDropdownOption(wrapper, 'count');
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

        expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
        wrapper.setProps({api, forceLoading: false});

        await tick();
        wrapper.update();

        expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
        expect(wrapper.find('CompactSelect')).toHaveLength(1);
        await openDropdown(wrapper);
        expect(wrapper.find('MenuItemWrap')).toHaveLength(2);
        expect(wrapper.find('DiscoverButton')).toHaveLength(1);
        expect(wrapper.find('Pagination')).toHaveLength(1);
        expect(wrapper.find('PanelTable')).toHaveLength(1);
        // 2 for the transaction names
        expect(wrapper.find('GridCell')).toHaveLength(2);
        // 2 for the counts
        expect(wrapper.find('GridCellNumber')).toHaveLength(2);
      });
    });

    describe('with events', function () {
      beforeEach(function () {
        organization.features.push('performance-frontend-use-events-endpoint');
      });

      it('renders basic UI components', async function () {
        wrapper = mountWithTheme(
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

        await tick();
        wrapper.update();

        expect(wrapper.find('CompactSelect')).toHaveLength(1);
        await openDropdown(wrapper);
        expect(wrapper.find('MenuItemWrap')).toHaveLength(2);
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

        await tick();
        wrapper.update();

        expect(wrapper.find('CompactSelect')).toHaveLength(1);
        await openDropdown(wrapper);
        expect(wrapper.find('MenuItemWrap')).toHaveLength(3);
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

        await tick();
        wrapper.update();

        const headers = wrapper.find('SortLink');
        expect(headers).toHaveLength(2);
        expect(headers.first().text()).toEqual('transaction');
        expect(headers.last().text()).toEqual('count()');
      });

      it('renders custom titles', async function () {
        wrapper = mountWithTheme(
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

        await tick();
        wrapper.update();

        const headers = wrapper.find('SortLink');
        expect(headers).toHaveLength(2);
        expect(headers.first().text()).toEqual('foo');
        expect(headers.last().text()).toEqual('bar');
      });

      it('allows users to change the sort in the dropdown', async function () {
        wrapper = mountWithTheme(
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

        await tick();
        wrapper.update();

        // initial sort is ascending by transaction name
        expect(wrapper.find('GridCell').first().text()).toEqual('/a');
        expect(wrapper.find('GridCellNumber').first().text()).toEqual('100');
        expect(wrapper.find('GridCell').last().text()).toEqual('/b');
        expect(wrapper.find('GridCellNumber').last().text()).toEqual('1000');

        await selectDropdownOption(wrapper, 'count');
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

        await tick();
        wrapper.update();

        const links = wrapper.find('Link');
        expect(links).toHaveLength(2);
        expect(links.first().props().to).toEqual(
          expect.objectContaining({
            pathname: `/${organization.slug}`,
            query: {
              transaction: '/a',
              'count()': 100,
            },
          })
        );
        expect(links.last().props().to).toEqual(
          expect.objectContaining({
            pathname: `/${organization.slug}`,
            query: {
              transaction: '/b',
              'count()': 1000,
            },
          })
        );
      });

      it('handles forceLoading correctly', async function () {
        wrapper = mountWithTheme(
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

        expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
        wrapper.setProps({api, forceLoading: false});

        await tick();
        wrapper.update();

        expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
        expect(wrapper.find('CompactSelect')).toHaveLength(1);
        await openDropdown(wrapper);
        expect(wrapper.find('MenuItemWrap')).toHaveLength(2);
        expect(wrapper.find('DiscoverButton')).toHaveLength(1);
        expect(wrapper.find('Pagination')).toHaveLength(1);
        expect(wrapper.find('PanelTable')).toHaveLength(1);
        // 2 for the transaction names
        expect(wrapper.find('GridCell')).toHaveLength(2);
        // 2 for the counts
        expect(wrapper.find('GridCellNumber')).toHaveLength(2);
      });

      it('sorts transactions table items by replay, preserving the initial sort positions', async function () {
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/events/`,
          body: {
            meta: {
              fields: {
                transaction: 'string',
                'transaction.duration': 'duration',
                replayId: 'string',
              },
            },
            data: [
              {transaction: '/a', 'transaction.duration': 5000, replayId: ''},
              {transaction: '/b', 'transaction.duration': 4000, replayId: ''},
              {transaction: '/c', 'transaction.duration': 4000, replayId: '123'},
              {transaction: '/d', 'transaction.duration': 3000, replayId: ''},
              {transaction: '/e', 'transaction.duration': 2500, replayId: ''},
              {transaction: '/f', 'transaction.duration': 2000, replayId: '123'},
              {transaction: '/g', 'transaction.duration': 1500, replayId: ''},
              {transaction: '/h', 'transaction.duration': 1000, replayId: ''},
              {transaction: '/i', 'transaction.duration': 1000, replayId: '123'},
            ],
          },
        });

        const eventViewWithReplay = EventView.fromSavedQuery({
          id: '',
          name: 'test query',
          version: 2,
          fields: ['transaction', 'transaction.duration', 'replayId'],
          projects: [project.id],
        });

        wrapper = mountWithTheme(
          <WrapperComponent
            api={api}
            location={location}
            organization={{
              ...organization,
              features: [...organization.features, 'session-replay-ui'],
            }}
            eventView={eventViewWithReplay}
            selected={options[0]}
            options={options}
            handleDropdownChange={handleDropdownChange}
            generateLink={generateLink}
          />
        );

        await tick();
        wrapper.update();

        // api data is sorted by transaction.duration
        expect(wrapper.find('GridCell').first().text()).toEqual('/c');
        expect(wrapper.find('GridCellNumber').first().text()).toEqual('4.00s');
        expect(wrapper.find('GridCell').at(2).text()).toEqual('/f');
        expect(wrapper.find('GridCellNumber').at(1).text()).toEqual('2.00s');
        expect(wrapper.find('GridCell').at(4).text()).toEqual('/i');
        expect(wrapper.find('GridCellNumber').at(2).text()).toEqual('1.00s');
        expect(wrapper.find('GridCell').at(6).text()).toEqual('/a');
        expect(wrapper.find('GridCellNumber').at(3).text()).toEqual('5.00s');
        expect(wrapper.find('GridCell').at(8).text()).toEqual('/b');
        expect(wrapper.find('GridCellNumber').at(4).text()).toEqual('4.00s');
        expect(wrapper.find('GridCell').at(16).text()).toEqual('/h');
        expect(wrapper.find('GridCellNumber').last().text()).toEqual('1.00s');
      });
    });
  });
});
