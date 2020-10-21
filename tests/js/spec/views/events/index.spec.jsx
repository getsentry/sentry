import {initializeOrg} from 'sentry-test/initializeOrg';
import {mockRouterPush} from 'sentry-test/mockRouterPush';
import {mountWithTheme} from 'sentry-test/enzyme';

import {setActiveOrganization} from 'app/actionCreators/organizations';
import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import EventsContainer from 'app/views/events';
import ProjectsStore from 'app/stores/projectsStore';

describe('EventsContainer', function () {
  let wrapper;
  const environments = ['production', 'staging'];
  const params = {
    orgId: 'org-slug',
  };

  const {organization, router, routerContext} = initializeOrg({
    projects: [
      {isMember: true, environments, isBookmarked: true},
      {isMember: true, slug: 'new-project', id: 3, environments},
    ],
    organization: {
      features: ['events', 'global-views'],
    },
    router: {
      location: {
        pathname: '/organizations/org-slug/events/',
        query: {},
      },
      params,
    },
  });

  beforeAll(async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [
        {count: 1, key: 'transaction', name: 'Transaction'},
        {count: 2, key: 'mechanism', name: 'Mechanism'},
      ],
    });

    setActiveOrganization(organization);
    await tick();
  });

  describe('Header', function () {
    beforeEach(async function () {
      GlobalSelectionStore.reset();
      ProjectsStore.loadInitialData(organization.projects);

      router.location = {
        pathname: '/organizations/org-slug/events/',
        query: {},
      };
      wrapper = mountWithTheme(
        <EventsContainer
          router={router}
          organization={organization}
          location={router.location}
        >
          <div />
        </EventsContainer>,
        routerContext
      );

      await tick();
      wrapper.update();

      mockRouterPush(wrapper, router);
    });

    it('updates router when changing environments', async function () {
      expect(wrapper.find('PageContent')).toHaveLength(1);
      expect(wrapper.find('MultipleEnvironmentSelector').prop('value')).toEqual([]);

      wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
      await tick();
      wrapper.update();

      wrapper.find('EnvironmentSelectorItem').at(0).simulate('click');

      await tick();
      wrapper.update();

      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/organizations/org-slug/events/',
        query: {
          environment: ['production'],
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
        .find('CheckboxHitbox')
        .simulate('click');

      // Value only updates if "Apply" is clicked or menu is closed
      wrapper
        .find('MultipleEnvironmentSelector StyledInput')
        .simulate('keyDown', {key: 'Escape'});

      await tick();
      wrapper.update();

      expect(wrapper.find('MultipleEnvironmentSelector').prop('value')).toEqual([
        'production',
        'staging',
      ]);

      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/organizations/org-slug/events/',
        query: {
          environment: ['production', 'staging'],
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
        },
      });
    });

    it('updates router when changing projects', async function () {
      expect(wrapper.find('MultipleProjectSelector').prop('value')).toEqual([]);

      wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');

      wrapper
        .find('MultipleProjectSelector AutoCompleteItem ProjectSelectorItem')
        .first()
        .simulate('click');

      await tick();
      wrapper.update();

      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/organizations/org-slug/events/',
        query: {
          environment: [],
          project: [2],
        },
      });
      expect(wrapper.find('MultipleProjectSelector').prop('value')).toEqual([2]);
    });

    it('selects multiple projects', async function () {
      expect(wrapper.find('MultipleProjectSelector').prop('value')).toEqual([]);

      wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');

      wrapper
        .find('MultipleProjectSelector AutoCompleteItem CheckboxHitbox')
        .at(0)
        .simulate('click');

      expect(wrapper.find('MultipleProjectSelector').prop('value')).toEqual([2]);

      wrapper
        .find('MultipleProjectSelector AutoCompleteItem CheckboxHitbox')
        .at(1)
        .simulate('click');

      expect(wrapper.find('MultipleProjectSelector').prop('value')).toEqual([2, 3]);

      wrapper.find('MultipleProjectSelector StyledChevron').simulate('click');

      expect(router.push).toHaveBeenLastCalledWith({
        pathname: '/organizations/org-slug/events/',
        query: {
          environment: [],
          project: [2, 3],
        },
      });
    });

    it('changes to absolute time (utc is default)', async function () {
      const start = new Date('2017-10-01T00:00:00.000Z');
      const end = new Date('2017-10-01T23:59:59.000Z');
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      await wrapper.find('SelectorItem[value="absolute"]').simulate('click');

      // Oct 1st
      wrapper.find('DayCell').at(0).simulate('mouseUp');
      expect(wrapper.find('UtcPicker Checkbox').prop('checked')).toBe(true);

      wrapper.find('TimeRangeSelector StyledChevron').simulate('click');

      await tick();
      wrapper.update();

      expect(router.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/events/',
        query: {
          start: '2017-10-01T00:00:00',
          end: '2017-10-01T23:59:59',
          utc: true,
        },
      });

      expect(wrapper.find('TimeRangeSelector').prop('start')).toEqual(start);
      expect(wrapper.find('TimeRangeSelector').prop('end')).toEqual(end);
      expect(wrapper.find('TimeRangeSelector').prop('relative')).toEqual(null);
      // Open menu and make sure UTC is checked
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');
      await tick();
      wrapper.update();
      expect(wrapper.find('UtcPicker Checkbox').prop('checked')).toBe(true);
    });

    it('does not update router when toggling environment selector without changes', async function () {
      const prevCallCount = router.push.mock.calls.length;

      wrapper.setProps({
        router: {
          ...router,
          location: {
            ...router.location,
            query: {
              environment: ['production'],
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

    it('updates router when changing periods', async function () {
      expect(wrapper.find('TimeRangeSelector').prop('start')).toEqual(null);
      expect(wrapper.find('TimeRangeSelector').prop('end')).toEqual(null);
      expect(wrapper.find('TimeRangeSelector').prop('relative')).toEqual('14d');

      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      expect(wrapper.find('[data-test-id="date-range"]')).toHaveLength(0);
      wrapper.find('SelectorItem[value="absolute"]').simulate('click');
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      await tick();
      wrapper.update();

      // The current date in local timezone is 2017-10-16T22:41:20-04:00
      // we take the local date and subtract 14d
      // If "UTC" override is true then we strip timezone and use that date for the range
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/events/',
        query: {
          end: '2017-10-16T22:41:20',
          start: '2017-10-02T22:41:20',
          utc: true,
        },
      });

      expect(wrapper.find('TimeRangeSelector').props()).toEqual(
        expect.objectContaining({
          end: new Date('2017-10-16T22:41:20.000Z'),
          start: new Date('2017-10-02T22:41:20.000Z'),
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

      // Note this is NOT called with utc true like the above because 1) it's a relative date
      // and we do not need UTC value (which is default true in tests because timezone is set to UTC)
      // and 2) we removed forcing a default value in url params so there is no explicit utc value
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/events/',
        query: {
          statsPeriod: '7d',
        },
      });

      expect(wrapper.find('TimeRangeSelector').props()).toEqual(
        expect.objectContaining({
          end: null,
          start: null,
          relative: '7d',
        })
      );
    });
  });
});
