import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByLabel} from 'sentry-test/select';

import {IssueListActions} from 'app/views/issueList/actions';
import SelectedGroupStore from 'app/stores/selectedGroupStore';

describe('IssueListActions', function () {
  let actions;
  let wrapper;

  describe('Bulk', function () {
    describe('Total results greater than bulk limit', function () {
      beforeAll(function () {
        const {routerContext, org} = initializeOrg();

        SelectedGroupStore.records = {};
        SelectedGroupStore.add([1, 2, 3]);
        wrapper = mountWithTheme(
          <IssueListActions
            api={new MockApiClient()}
            allResultsVisible={false}
            query=""
            queryCount={1500}
            orgId="1337"
            organization={org}
            projectId="project-slug"
            selection={{
              projects: [1],
              environments: [],
              datetime: {start: null, end: null, period: null, utc: true},
            }}
            groupIds={[1, 2, 3]}
            onRealtimeChange={function () {}}
            onSelectStatsPeriod={function () {}}
            realtimeActive={false}
            statsPeriod="24h"
          />,
          routerContext
        );
      });

      it('after checking "Select all" checkbox, displays bulk select message', async function () {
        wrapper.find('ActionsCheckbox Checkbox').simulate('change');
        expect(wrapper.find('SelectAllNotice')).toSnapshot();
      });

      it('can bulk select', function () {
        wrapper.find('SelectAllNotice').find('a').simulate('click');

        expect(wrapper.find('SelectAllNotice')).toSnapshot();
      });

      it('bulk resolves', async function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/1337/issues/',
          method: 'PUT',
        });
        wrapper.find('ResolveActions ActionLink').first().simulate('click');

        expect(wrapper.find('ModalDialog')).toSnapshot();
        wrapper.find('Button[priority="primary"]').simulate('click');
        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              project: [1],
            },
            data: {status: 'resolved'},
          })
        );

        await tick();
        wrapper.update();
      });
    });

    describe('Total results less than bulk limit', function () {
      beforeAll(function () {
        SelectedGroupStore.records = {};
        SelectedGroupStore.add([1, 2, 3]);
        wrapper = mountWithTheme(
          <IssueListActions
            api={new MockApiClient()}
            allResultsVisible={false}
            query=""
            queryCount={600}
            orgId="1337"
            organization={TestStubs.routerContext().context.organization}
            projectId="1"
            selection={{
              projects: [1],
              environments: [],
              datetime: {start: null, end: null, period: null, utc: true},
            }}
            groupIds={[1, 2, 3]}
            onRealtimeChange={function () {}}
            onSelectStatsPeriod={function () {}}
            realtimeActive={false}
            statsPeriod="24h"
          />,
          TestStubs.routerContext()
        );
      });

      it('after checking "Select all" checkbox, displays bulk select message', async function () {
        wrapper.find('ActionsCheckbox Checkbox').simulate('change');
        expect(wrapper.find('SelectAllNotice')).toSnapshot();
      });

      it('can bulk select', function () {
        wrapper.find('SelectAllNotice').find('a').simulate('click');

        expect(wrapper.find('SelectAllNotice')).toSnapshot();
      });

      it('bulk resolves', async function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/1337/issues/',
          method: 'PUT',
        });
        wrapper.find('ResolveActions ActionLink').first().simulate('click');

        expect(wrapper.find('ModalDialog')).toSnapshot();
        wrapper.find('Button[priority="primary"]').simulate('click');
        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              project: [1],
            },
            data: {status: 'resolved'},
          })
        );

        await tick();
        wrapper.update();
      });
    });

    describe('Selected on page', function () {
      beforeAll(function () {
        SelectedGroupStore.records = {};
        SelectedGroupStore.add([1, 2, 3]);
        wrapper = mountWithTheme(
          <IssueListActions
            api={new MockApiClient()}
            allResultsVisible
            query=""
            queryCount={15}
            orgId="1337"
            organization={TestStubs.routerContext().context.organization}
            projectId="1"
            selection={{
              projects: [1],
              environments: [],
              datetime: {start: null, end: null, period: null, utc: true},
            }}
            groupIds={[1, 2, 3, 6, 9]}
            onRealtimeChange={function () {}}
            onSelectStatsPeriod={function () {}}
            realtimeActive={false}
            statsPeriod="24h"
          />,
          TestStubs.routerContext()
        );
      });

      it('resolves selected items', function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/1337/issues/',
          method: 'PUT',
        });
        jest
          .spyOn(SelectedGroupStore, 'getSelectedIds')
          .mockImplementation(() => new Set([3, 6, 9]));

        wrapper.setState({allInQuerySelected: false, anySelected: true});
        wrapper.find('ResolveActions ActionLink').first().simulate('click');
        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              id: [3, 6, 9],
              project: [1],
            },
            data: {status: 'resolved'},
          })
        );
      });

      it('ignores selected items', function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/1337/issues/',
          method: 'PUT',
        });
        jest
          .spyOn(SelectedGroupStore, 'getSelectedIds')
          .mockImplementation(() => new Set([3, 6, 9]));

        wrapper.setState({allInQuerySelected: false, anySelected: true});
        wrapper.find('IgnoreActions MenuItem a').last().simulate('click');

        wrapper
          .find('CustomIgnoreCountModal input[label="Number of users"]')
          .simulate('change', {target: {value: 300}});

        selectByLabel(wrapper, 'per week', {
          name: 'window',
        });

        wrapper
          .find('CustomIgnoreCountModal Button[priority="primary"]')
          .simulate('click');

        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              id: [3, 6, 9],
              project: [1],
            },
            data: {
              status: 'ignored',
              statusDetails: {
                ignoreUserCount: 300,
                ignoreUserWindow: 10080,
              },
            },
          })
        );
      });
    });
  });

  describe('actionSelectedGroups()', function () {
    beforeAll(function () {
      jest.spyOn(SelectedGroupStore, 'deselectAll');
    });

    beforeEach(function () {
      SelectedGroupStore.deselectAll.mockReset();
      actions = mountWithTheme(
        <IssueListActions
          api={new MockApiClient()}
          query=""
          orgId="1337"
          organization={TestStubs.routerContext().context.organization}
          projectId="1"
          selection={{
            projects: [1],
            environments: [],
            datetime: {start: null, end: null, period: null, utc: true},
          }}
          groupIds={[1, 2, 3]}
          onRealtimeChange={function () {}}
          onSelectStatsPeriod={function () {}}
          realtimeActive={false}
          statsPeriod="24h"
        />
      ).instance();
    });

    afterAll(function () {
      SelectedGroupStore.deselectAll.mockRestore();
    });

    describe('for all items', function () {
      it("should invoke the callback with 'undefined' and deselect all", function () {
        const callback = jest.fn();

        actions.state.allInQuerySelected = true;

        actions.actionSelectedGroups(callback);

        expect(callback).toHaveBeenCalledWith(undefined);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(SelectedGroupStore.deselectAll).toHaveBeenCalledTimes(1);

        // all selected is reset
        expect(actions.state.allInQuerySelected).toBe(false);
      });
    });

    describe('for page-selected items', function () {
      it('should invoke the callback with an array of selected items and deselect all', function () {
        jest
          .spyOn(SelectedGroupStore, 'getSelectedIds')
          .mockImplementation(() => new Set([1, 2, 3]));

        actions.state.allInQuerySelected = false;
        const callback = jest.fn();
        actions.actionSelectedGroups(callback);

        expect(callback).toHaveBeenCalledWith([1, 2, 3]);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(SelectedGroupStore.deselectAll).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('missing projectId prop', function () {
    beforeEach(function () {
      wrapper = mountWithTheme(
        <IssueListActions
          api={new MockApiClient()}
          query=""
          orgId="1337"
          organization={TestStubs.routerContext().context.organization}
          groupIds={[1, 2, 3]}
          selection={{
            projects: [],
            environments: [],
            datetime: {start: null, end: null, period: null, utc: true},
          }}
          onRealtimeChange={function () {}}
          onSelectStatsPeriod={function () {}}
          realtimeActive={false}
          statsPeriod="24h"
        />,
        TestStubs.routerContext()
      );
    });

    it('should disable resolve dropdown but not resolve action', function () {
      const resolve = wrapper.find('ResolveActions').first();
      expect(resolve.props().disabled).toBe(false);
      expect(resolve.props().disableDropdown).toBe(true);
    });

    it('should disable merge button', function () {
      const merge = wrapper.find('ActionLink[className~="action-merge"]').first();
      expect(merge.props().disabled).toBe(true);
    });
  });
});
