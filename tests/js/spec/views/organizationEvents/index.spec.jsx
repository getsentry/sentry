import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {mockRouterPush} from 'app-test/helpers/mockRouterPush';
import {mount} from 'enzyme';
import {setActiveOrganization} from 'app/actionCreators/organizations';
import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import OrganizationEventsContainer from 'app/views/organizationEvents';

describe('OrganizationEvents', function() {
  let wrapper;
  const {organization, router, routerContext} = initializeOrg({
    projects: [{isMember: true}, {isMember: true, slug: 'new-project', id: 3}],
    organization: {
      features: ['global-views'],
    },
    router: {
      location: {
        pathname: '/organizations/org-slug/events/',
        query: {},
      },
    },
  });

  beforeAll(async function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [{count: 1, tag: 'transaction'}, {count: 2, tag: 'mechanism'}],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/environments/`,
      body: TestStubs.Environments(),
    });

    setActiveOrganization(organization);
    await tick();
  });

  describe('Header', function() {
    beforeEach(function() {
      GlobalSelectionStore.reset();

      router.location = {
        pathname: '/organizations/org-slug/events/',
        query: {},
      };
      wrapper = mount(
        <OrganizationEventsContainer
          router={router}
          organization={organization}
          location={router.location}
        >
          <div />
        </OrganizationEventsContainer>,
        routerContext
      );

      mockRouterPush(wrapper, router);
    });

    it('renders', function() {
      expect(wrapper.find('OrganizationEventsContent')).toHaveLength(1);
    });

    it('updates router when changing environments', async function() {
      expect(wrapper.find('MultipleEnvironmentSelector').prop('value')).toEqual([]);

      wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
      await tick();
      wrapper.update();

      wrapper
        .find('EnvironmentSelectorItem')
        .at(0)
        .simulate('click');

      await tick();
      wrapper.update();

      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/organizations/org-slug/events/',
        query: {
          environment: ['production'],
          statsPeriod: '14d',
        },
      });

      await tick();
      wrapper.update();

      expect(wrapper.find('MultipleEnvironmentSelector').prop('value')).toEqual([
        'production',
      ]);

      // Select a second environment, "staging"
      wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
      await tick();
      wrapper.update();
      wrapper
        .find('EnvironmentSelectorItem')
        .at(1)
        .find('MultiSelect')
        .simulate('click');

      expect(wrapper.find('MultipleEnvironmentSelector').prop('value')).toEqual([
        'production',
        'staging',
      ]);

      // close dropdown
      wrapper
        .find('MultipleEnvironmentSelector StyledInput')
        .simulate('keyDown', {key: 'Escape'});

      await tick();
      wrapper.update();
      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/organizations/org-slug/events/',
        query: {
          environment: ['production', 'staging'],
          statsPeriod: '14d',
        },
      });

      expect(wrapper.find('MultipleEnvironmentSelector').prop('value')).toEqual([
        'production',
        'staging',
      ]);

      // Can clear
      wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
      await tick();
      wrapper.update();

      wrapper
        .find('MultipleEnvironmentSelector HeaderItem StyledClose')
        .simulate('click');

      await tick();
      wrapper.update();

      expect(wrapper.find('MultipleEnvironmentSelector').prop('value')).toEqual([]);
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/events/',
        query: {
          environment: [],
          statsPeriod: '14d',
        },
      });
    });

    it('updates router when changing projects', async function() {
      expect(wrapper.find('MultipleProjectSelector').prop('value')).toEqual([]);

      wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');

      wrapper
        .find('MultipleProjectSelector AutoCompleteItem')
        .at(0)
        .simulate('click');

      await tick();
      wrapper.update();

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/events/',
        query: {
          project: [2],
          statsPeriod: '14d',
        },
      });
      expect(wrapper.find('MultipleProjectSelector').prop('value')).toEqual([2]);
    });

    it('selects multiple projects', async function() {
      expect(wrapper.find('MultipleProjectSelector').prop('value')).toEqual([]);

      wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');

      wrapper
        .find('MultipleProjectSelector AutoCompleteItem MultiSelectWrapper')
        .at(0)
        .simulate('click');

      expect(wrapper.find('MultipleProjectSelector').prop('value')).toEqual([2]);

      wrapper
        .find('MultipleProjectSelector AutoCompleteItem MultiSelectWrapper')
        .at(1)
        .simulate('click');

      expect(wrapper.find('MultipleProjectSelector').prop('value')).toEqual([2, 3]);

      wrapper.find('MultipleProjectSelector StyledChevron').simulate('click');

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/events/',
        query: {
          project: [2, 3],
          statsPeriod: '14d',
        },
      });
    });

    it('changes to absolute time (utc is default)', async function() {
      const start = new Date('2017-10-01T00:00:00.000Z');
      const end = new Date('2017-10-01T23:59:59.000Z');
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      await wrapper.find('SelectorItem[value="absolute"]').simulate('click');

      // Oct 1st
      wrapper
        .find('DayCell')
        .at(0)
        .simulate('mouseUp');

      wrapper.find('TimeRangeSelector StyledChevron').simulate('click');

      await tick();
      wrapper.update();

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/events/',
        query: {
          start: '2017-10-01T00:00:00',
          end: '2017-10-01T23:59:59',
          utc: 'true',
        },
      });

      expect(wrapper.find('TimeRangeSelector').prop('start')).toEqual(start);
      expect(wrapper.find('TimeRangeSelector').prop('end')).toEqual(end);
      expect(wrapper.find('TimeRangeSelector').prop('relative')).toEqual(null);
    });

    it('does not update router when toggling environment selector without changes', async function() {
      const prevCallCount = router.push.mock.calls.length;

      wrapper.setProps({
        router: {
          ...router,
          location: {
            ...router.location,
            query: {
              environment: ['production'],
              statsPeriod: '14d',
              utc: 'true',
            },
          },
        },
      });

      // Toggle MultipleProjectSelector
      wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
      wrapper
        .find('MultipleEnvironmentSelector StyledInput')
        .simulate('keyDown', {key: 'Escape'});
      expect(router.push).toHaveBeenCalledTimes(prevCallCount);
    });

    it('updates router when changing periods', async function() {
      expect(wrapper.find('TimeRangeSelector').prop('start')).toEqual(null);
      expect(wrapper.find('TimeRangeSelector').prop('end')).toEqual(null);
      expect(wrapper.find('TimeRangeSelector').prop('relative')).toEqual('14d');

      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      expect(wrapper.find('[data-test-id="date-range"]')).toHaveLength(0);
      wrapper.find('SelectorItem[value="absolute"]').simulate('click');
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      await tick();
      wrapper.update();

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/events/',
        query: {
          end: '2017-10-17T02:41:20',
          start: '2017-10-03T02:41:20',
          utc: 'true',
        },
      });

      expect(wrapper.find('TimeRangeSelector').props()).toEqual(
        expect.objectContaining({
          end: new Date('2017-10-17T02:41:20.000Z'),
          start: new Date('2017-10-03T02:41:20.000Z'),
          utc: true,
        })
      );

      // Can switch back to relative date
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');
      wrapper.find('SelectorItem[value="7d"]').simulate('click');
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      await tick();
      wrapper.update();

      expect(wrapper.find('TimeRangeSelector').prop('relative')).toEqual('7d');

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/events/',
        query: {
          statsPeriod: '7d',
          utc: 'true',
        },
      });

      expect(wrapper.find('TimeRangeSelector').props()).toEqual(
        expect.objectContaining({
          end: null,
          start: null,
          relative: '7d',
          utc: true,
        })
      );
    });

    it('updates TimeRangeSelector when changing routes', async function() {
      let newRouter = {
        router: {
          ...router,
          location: {
            pathname: '/organizations/org-slug/events2/',
            query: {
              end: '2017-10-17T02:41:20',
              start: '2017-10-03T02:41:20',
              utc: 'true',
            },
          },
        },
      };
      wrapper.setProps(newRouter);
      wrapper.setContext(newRouter);

      await tick();
      wrapper.update();

      expect(wrapper.find('TimeRangeSelector').text()).toEqual(
        'Oct 3, 201702:41toOct 17, 201702:41'
      );

      newRouter = {
        router: {
          ...router,
          location: {
            pathname: '/organizations/org-slug/events/',
            query: {
              statsPeriod: '7d',
              end: null,
              start: null,
              utc: 'true',
            },
          },
        },
      };

      wrapper.setProps(newRouter);
      wrapper.setContext(newRouter);

      await tick();
      wrapper.update();

      expect(wrapper.find('TimeRangeSelector').text()).toEqual('Last 7 days');
    });
  });
});
