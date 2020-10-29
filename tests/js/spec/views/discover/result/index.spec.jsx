import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import Result from 'app/views/discover/result';
import createQueryBuilder from 'app/views/discover/queryBuilder';

describe('Result', function () {
  describe('New query', function () {
    let wrapper, data, organization;
    beforeEach(function () {
      organization = TestStubs.Organization();

      data = {
        baseQuery: {
          data: {data: [], meta: [], timing: {duration_ms: 15}},
          query: {
            aggregations: [['count()', null, 'count']],
            conditions: [],
            fields: [],
          },
        },
        byDayQuery: {
          query: null,
          data: null,
        },
      };
      wrapper = mountWithTheme(
        <Result
          data={data}
          organization={organization}
          onFetchPage={jest.fn()}
          location={{
            query: {},
            search: '',
          }}
        />,
        {
          context: {organization},
        }
      );
    });

    afterEach(function () {
      MockApiClient.clearMockResponses();
    });

    describe('Render Summary', function () {
      it('shows correct range for pagination in summary', async function () {
        data = {
          data: {
            baseQuery: {
              query: {
                aggregations: [],
                conditions: [],
                fields: ['foo'],
                projects: [1],
              },
              data: {
                data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                meta: [],
                timing: {duration_ms: 15},
              },
              previous: null,
              current: '0:0:1',
              next: '0:10:0',
            },
            byDayQuery: {
              query: null,
              data: null,
            },
          },
        };
        wrapper.setProps(data);

        expect(wrapper.find('ResultSummary').render().text()).toEqual(
          'query time: 15ms, rows 1 - 10'
        );
      });

      it('shows correct number of results shown when going to next page (next page function mocked on click)', async function () {
        data = {
          data: {
            baseQuery: {
              query: {
                aggregations: [],
                conditions: [],
                fields: ['foo'],
                projects: [1],
              },
              data: {
                data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                meta: [],
                timing: {duration_ms: 15},
              },
              previous: '0:0:1',
              current: '0:10:0',
              next: '0:20:0',
            },
            byDayQuery: {
              query: null,
              data: null,
            },
          },
        };
        wrapper.setProps(data);

        expect(wrapper.find('ResultSummary').render().text()).toBe(
          'query time: 15ms, rows 11 - 20'
        );
      });

      it('shows 0 Results with no data', async function () {
        wrapper.setProps({
          data: {
            baseQuery: {
              query: {
                aggregations: [],
                conditions: [],
                fields: ['foo'],
                projects: [1],
              },
              data: {data: [], meta: [], timing: {duration_ms: 15}},
              previous: null,
              current: '0:10:0',
              next: null,
            },
            byDayQuery: {
              query: null,
              data: null,
            },
          },
        });

        expect(wrapper.find('ResultSummary').render().text()).toBe(
          'query time: 15ms, 0 rows'
        );
      });
    });

    describe('Toggles Visualizations', function () {
      beforeEach(function () {
        wrapper = mountWithTheme(
          <Result
            data={data}
            organization={organization}
            onFetchPage={jest.fn()}
            location={{query: {}, search: ''}}
          />,
          TestStubs.routerContext([{organization}])
        );
      });

      it('displays options', function () {
        const buttons = wrapper.find('ResultViewButtons').find('a');
        expect(buttons).toHaveLength(3);
      });

      it('toggles buttons', function () {
        expect(wrapper.find('ResultTable')).toHaveLength(1);
        expect(wrapper.find('LineChart')).toHaveLength(0);

        wrapper.find('ResultViewButtons').find('a').at(1).simulate('click');
        wrapper.update();

        expect(wrapper.find('ResultTable')).toHaveLength(0);
        expect(wrapper.find('LineChart')).toHaveLength(1);
      });

      it('toggles dropdown', function () {
        expect(wrapper.find('ResultTable')).toHaveLength(1);
        expect(wrapper.find('LineChart')).toHaveLength(0);

        wrapper.find('ul.dropdown-menu').find('span').at(1).simulate('click');

        expect(wrapper.find('ResultTable')).toHaveLength(0);
        expect(wrapper.find('LineChart')).toHaveLength(1);
      });
    });
  });

  describe('Saved query', function () {
    let wrapper, queryBuilder;
    beforeEach(function () {
      const organization = TestStubs.Organization();
      queryBuilder = createQueryBuilder({}, organization);
      queryBuilder.updateField('aggregations', [['count()', null, 'count']]);

      const data = {
        baseQuery: {
          query: queryBuilder.getInternal(),
          data: {data: [], meta: [], timing: {duration_ms: 15}},
        },
        byDayQuery: {
          query: null,
          data: null,
        },
      };
      wrapper = mountWithTheme(
        <Result
          data={data}
          organization={organization}
          savedQuery={TestStubs.DiscoverSavedQuery()}
          onFetchPage={jest.fn()}
          location={{query: {}}}
        />,
        TestStubs.routerContext()
      );
    });

    it('renders query name', function () {
      expect(wrapper.find('PageHeading').text()).toBe('Saved query #1');
    });
  });
});
