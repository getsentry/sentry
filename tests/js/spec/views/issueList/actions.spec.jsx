import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';
import {selectByLabel} from 'sentry-test/select-new';

import SelectedGroupStore from 'app/stores/selectedGroupStore';
import {IssueListActions} from 'app/views/issueList/actions';

describe('IssueListActions', function () {
  let actions;
  let wrapper;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Bulk', function () {
    describe('Total results greater than bulk limit', function () {
      beforeAll(function () {
        const {routerContext, org} = initializeOrg();

        SelectedGroupStore.records = {};
        SelectedGroupStore.add(['1', '2', '3']);
        wrapper = mountWithTheme(
          <IssueListActions
            api={new MockApiClient()}
            allResultsVisible={false}
            query=""
            queryCount={1500}
            organization={org}
            projectId="project-slug"
            selection={{
              projects: [1],
              environments: [],
              datetime: {start: null, end: null, period: null, utc: true},
            }}
            groupIds={['1', '2', '3']}
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
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });
        wrapper.find('ResolveActions button[aria-label="Resolve"]').simulate('click');

        const modal = await mountGlobalModal();
        expect(modal.find('Modal')).toSnapshot();

        modal.find('Button[priority="primary"]').simulate('click');

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
        SelectedGroupStore.add(['1', '2', '3']);
        wrapper = mountWithTheme(
          <IssueListActions
            api={new MockApiClient()}
            allResultsVisible={false}
            query=""
            queryCount={600}
            organization={TestStubs.routerContext().context.organization}
            projectId="1"
            selection={{
              projects: [1],
              environments: [],
              datetime: {start: null, end: null, period: null, utc: true},
            }}
            groupIds={['1', '2', '3']}
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
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });
        wrapper.find('ResolveActions button[aria-label="Resolve"]').simulate('click');

        const modal = await mountGlobalModal();
        expect(modal.find('Modal')).toSnapshot();
        modal.find('Button[priority="primary"]').simulate('click');

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
        SelectedGroupStore.add(['1', '2', '3']);
        wrapper = mountWithTheme(
          <IssueListActions
            api={new MockApiClient()}
            allResultsVisible
            query=""
            queryCount={15}
            organization={TestStubs.routerContext().context.organization}
            projectId="1"
            selection={{
              projects: [1],
              environments: [],
              datetime: {start: null, end: null, period: null, utc: true},
            }}
            groupIds={['1', '2', '3', '6', '9']}
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
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });
        jest
          .spyOn(SelectedGroupStore, 'getSelectedIds')
          .mockImplementation(() => new Set(['3', '6', '9']));

        wrapper
          .find('IssueListActions')
          .setState({allInQuerySelected: false, anySelected: true});
        wrapper.find('ResolveActions ActionLink').first().simulate('click');
        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              id: ['3', '6', '9'],
              project: [1],
            },
            data: {status: 'resolved'},
          })
        );
      });

      it('ignores selected items', async function () {
        const apiMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          method: 'PUT',
        });
        jest
          .spyOn(SelectedGroupStore, 'getSelectedIds')
          .mockImplementation(() => new Set(['3', '6', '9']));

        wrapper
          .find('IssueListActions')
          .setState({allInQuerySelected: false, anySelected: true});
        wrapper.find('DropdownMenuItem ActionSubMenu a').last().simulate('click');

        const modal = await mountGlobalModal();

        modal
          .find('CustomIgnoreCountModal input[label="Number of users"]')
          .simulate('change', {target: {value: 300}});

        selectByLabel(modal, 'per week', {
          name: 'window',
        });

        modal.find('Button[priority="primary"]').simulate('click');

        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              id: ['3', '6', '9'],
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
    beforeEach(function () {
      jest.spyOn(SelectedGroupStore, 'deselectAll');
      actions = mountWithTheme(
        <IssueListActions
          api={new MockApiClient()}
          query=""
          organization={TestStubs.routerContext().context.organization}
          projectId="1"
          selection={{
            projects: [1],
            environments: [],
            datetime: {start: null, end: null, period: null, utc: true},
          }}
          groupIds={['1', '2', '3']}
          onRealtimeChange={function () {}}
          onSelectStatsPeriod={function () {}}
          realtimeActive={false}
          statsPeriod="24h"
        />
      ).instance();
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
          .mockImplementation(() => new Set(['1', '2', '3']));

        actions.state.allInQuerySelected = false;
        const callback = jest.fn();
        actions.actionSelectedGroups(callback);

        expect(callback).toHaveBeenCalledWith(['1', '2', '3']);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(SelectedGroupStore.deselectAll).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('multiple groups from different project', function () {
    beforeEach(function () {
      jest
        .spyOn(SelectedGroupStore, 'getSelectedIds')
        .mockImplementation(() => new Set(['1', '2', '3']));

      wrapper = mountWithTheme(
        <IssueListActions
          api={new MockApiClient()}
          query=""
          organization={TestStubs.routerContext().context.organization}
          groupIds={['1', '2', '3']}
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
      expect(
        wrapper.find('button[aria-label="Merge Selected Issues"]').props()[
          'aria-disabled'
        ]
      ).toBe(true);
    });
  });

  describe('with inbox feature', function () {
    beforeEach(async () => {
      SelectedGroupStore.init();
      await tick();
      const {organization} = TestStubs.routerContext().context;
      wrapper = mountWithTheme(
        <IssueListActions
          api={new MockApiClient()}
          query=""
          organization={organization}
          groupIds={['1', '2', '3']}
          selection={{
            projects: [],
            environments: [],
            datetime: {start: null, end: null, period: null, utc: true},
          }}
          onRealtimeChange={function () {}}
          onSelectStatsPeriod={function () {}}
          realtimeActive={false}
          statsPeriod="24h"
          queryCount={100}
          displayCount="3 of 3"
          hasInbox
        />,
        TestStubs.routerContext()
      );
    });

    it('hides actions when no issues are selected', async function () {
      expect(wrapper.find('[aria-label="Mark Reviewed"]').exists()).toBe(false);
    });

    it('displays actions on issue selection', async function () {
      wrapper.find('IssueListActions').setState({anySelected: true});
      expect(wrapper.find('[aria-label="Mark Reviewed"]').exists()).toBe(true);
    });

    it('acknowledges group', async function () {
      wrapper.find('IssueListActions').setState({anySelected: true});
      SelectedGroupStore.add(['1', '2', '3']);
      SelectedGroupStore.toggleSelectAll();

      await tick();
      wrapper.update();

      const apiMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });
      wrapper.find('button[aria-label="Mark Reviewed"]').simulate('click');

      expect(apiMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {inbox: false},
        })
      );
    });
  });
});
