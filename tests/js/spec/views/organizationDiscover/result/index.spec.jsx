import React from 'react';
import {mount, shallow} from 'enzyme';

import Result from 'app/views/organizationDiscover/result';
import createQueryBuilder from 'app/views/organizationDiscover/queryBuilder';

describe('Result', function() {
  describe('New query', function() {
    describe('Basic query', function() {
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
        wrapper = shallow(
          <Result queryBuilder={queryBuilder} data={data} organization={organization} />
        );
      });

      afterEach(function() {
        MockApiClient.clearMockResponses();
      });

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

      it('can be saved', async function() {
        const createMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/discover/saved/',
          method: 'POST',
        });

        wrapper.find('SavedQueryAction[data-test-id="save"]').simulate('click');
        wrapper.find('SavedQueryAction[data-test-id="confirm"]').simulate('click');
        await tick();
        expect(createMock).toHaveBeenCalledWith(
          '/organizations/org-slug/discover/saved/',
          expect.objectContaining({
            data: expect.objectContaining(queryBuilder.getExternal()),
          })
        );
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
        />
      );
    });

    it('renders query name', function() {
      expect(wrapper.find('Heading').text()).toBe('Saved query #1');
    });
  });
});
