import React from 'react';
import {mount, shallow} from 'enzyme';

import Result from 'app/views/organizationDiscover/result';
import createQueryBuilder from 'app/views/organizationDiscover/queryBuilder';

describe('Result', function() {
  describe('New query', function() {
    let wrapper;
    beforeEach(function() {
      const organization = TestStubs.Organization();

      const data = {
        baseQuery: {
          data: {data: [], meta: [], timing: {duration_ms: 15}},
          query: {
            aggregations: [['count()', null, 'count']],
            conditions: [],
          },
        },
        byDayQuery: {
          query: null,
          data: null,
        },
      };
      wrapper = shallow(
        <Result data={data} organization={organization} onFetchPage={jest.fn()} />,
        {
          context: {organization},
          disableLifecycleMethods: false,
        }
      );
    });

    afterEach(function() {
      MockApiClient.clearMockResponses();
    });

    describe('Basic query', function() {
      it('displays options', function() {
        const buttons = wrapper.find('.btn-group').find('a');
        expect(buttons).toHaveLength(3);
      });

      it('toggles', function() {
        expect(wrapper.find('ResultTable')).toHaveLength(1);
        expect(wrapper.find('LineChart')).toHaveLength(0);
        wrapper
          .find('.btn-group')
          .find('a')
          .at('1')
          .simulate('click');
        wrapper.update();
        expect(wrapper.find('ResultTable')).toHaveLength(0);
        expect(wrapper.find('LineChart')).toHaveLength(1);
      });
    });

    describe('Render Summary', function() {
      it('shows correct range for pagination in summary', async function() {
        const data = {
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

        expect(
          wrapper
            .find('ResultSummary')
            .render()
            .text()
        ).toEqual('query time: 15 ms, rows 1 - 10');
      });

      it('shows correct number of results shown when going to next page (next page function mocked on click)', async function() {
        const data = {
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

        expect(
          wrapper
            .find('ResultSummary')
            .render()
            .text()
        ).toBe('query time: 15 ms, rows 11 - 20');
      });

      it('shows 0 Results with no data', async function() {
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

        expect(
          wrapper
            .find('ResultSummary')
            .render()
            .text()
        ).toBe('query time: 15 ms, 0 rows');
      });
    });
  });

  describe('Saved query', function() {
    let wrapper, queryBuilder;
    beforeEach(function() {
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
      wrapper = mount(
        <Result
          queryBuilder={queryBuilder}
          data={data}
          organization={organization}
          savedQuery={TestStubs.DiscoverSavedQuery()}
          onFetchPage={jest.fn()}
        />,
        TestStubs.routerContext()
      );
    });

    it('renders query name', function() {
      expect(wrapper.find('Heading').text()).toBe('Saved query #1');
    });
  });
});
