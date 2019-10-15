import React from 'react';
import {mountWithTheme, shallow} from 'sentry-test/enzyme';

import {IssueListActions} from 'app/views/issueList/actions';
import {initializeOrg} from 'sentry-test/initializeOrg';

import MemberListStore from 'app/stores/memberListStore';
import SelectedGroupStore from 'app/stores/selectedGroupStore';

describe('IssueListActions', function() {
  let actions;
  let wrapper;
  let apiMock, storeMock;

  beforeEach(function() {});

  afterEach(function() {});

  describe('Bulk', function() {
    describe('Total results > bulk limit', function() {
      beforeAll(function() {
        const {routerContext} = initializeOrg({
          organization: {
            features: ['incidents'],
          },
        });

        SelectedGroupStore.records = {};
        SelectedGroupStore.add(['1', '2', '3']);
        wrapper = mountWithTheme(
          <IssueListActions
            api={new MockApiClient()}
            allResultsVisible={false}
            query=""
            queryCount={1500}
            orgId="1337"
            projectId="project-slug"
            selection={{
              projects: [1],
              environments: [],
              datetime: {start: null, end: null, period: null, utc: true},
            }}
            groupIds={['1', '2', '3']}
            onRealtimeChange={function() {}}
            onSelectStatsPeriod={function() {}}
            realtimeActive={false}
            statsPeriod="24h"
          />,
          routerContext
        );
      });

      afterEach(function() {
        MockApiClient.clearMockResponses();
      });

      it('after checking "Select all" checkbox, displays bulk select message', async function() {
        wrapper.find('ActionsCheckbox Checkbox').simulate('change');
        expect(wrapper.find('.stream-select-all-notice')).toMatchSnapshot();
      });

      it('can bulk select', function() {
        wrapper.find('.stream-select-all-notice a').simulate('click');

        expect(wrapper.find('.stream-select-all-notice')).toMatchSnapshot();
      });

      it('has "Create Incidents" disabled', function() {
        // Do not allow users to create incidents with "bulk" selection
        expect(
          wrapper
            .find('a[aria-label="Create new incident"]')
            .at(0)
            .prop('disabled')
        ).toBe(true);
        expect(
          wrapper
            .find('a[aria-label="Create new incident"]')
            .at(1)
            .prop('disabled')
        ).toBe(true);
      });

      it('bulk resolves', async function() {
        apiMock = MockApiClient.addMockResponse({
          url: '/organizations/1337/issues/',
          method: 'PUT',
        });
        wrapper
          .find('ResolveActions ActionLink')
          .first()
          .simulate('click');

        expect(wrapper.find('ModalDialog')).toMatchSnapshot();
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

    describe('Total results < bulk limit', function() {
      beforeAll(function() {
        SelectedGroupStore.records = {};
        SelectedGroupStore.add(['1', '2', '3']);
        wrapper = mountWithTheme(
          <IssueListActions
            api={new MockApiClient()}
            allResultsVisible={false}
            query=""
            queryCount={600}
            orgId="1337"
            projectId="1"
            selection={{
              projects: [1],
              environments: [],
              datetime: {start: null, end: null, period: null, utc: true},
            }}
            groupIds={['1', '2', '3']}
            onRealtimeChange={function() {}}
            onSelectStatsPeriod={function() {}}
            realtimeActive={false}
            statsPeriod="24h"
          />,
          TestStubs.routerContext()
        );
      });

      afterEach(function() {
        MockApiClient.clearMockResponses();
      });

      it('after checking "Select all" checkbox, displays bulk select message', async function() {
        wrapper.find('ActionsCheckbox Checkbox').simulate('change');
        expect(wrapper.find('.stream-select-all-notice')).toMatchSnapshot();
      });

      it('can bulk select', function() {
        wrapper.find('.stream-select-all-notice a').simulate('click');
        expect(wrapper.find('.stream-select-all-notice')).toMatchSnapshot();
      });

      it('bulk resolves', async function() {
        apiMock = MockApiClient.addMockResponse({
          url: '/organizations/1337/issues/',
          method: 'PUT',
        });

        wrapper
          .find('ResolveActions ActionLink')
          .first()
          .simulate('click');
        expect(wrapper.find('ModalDialog')).toMatchSnapshot();

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

    describe('Selected on page', function() {
      beforeAll(function() {
        SelectedGroupStore.records = {};
        SelectedGroupStore.add(['1', '2', '3']);

        MemberListStore.loadInitialData([
          TestStubs.User({
            id: '1',
            name: 'Jane Doe',
            email: 'janedoe@example.com',
          }),
        ]);
      });

      beforeEach(function() {
        wrapper = mountWithTheme(
          <IssueListActions
            api={new MockApiClient()}
            allResultsVisible
            query=""
            queryCount={15}
            orgId="1337"
            projectId="1"
            selection={{
              projects: [1],
              environments: [],
              datetime: {start: null, end: null, period: null, utc: true},
            }}
            groupIds={['1', '2', '3', '6', '9']}
            onRealtimeChange={function() {}}
            onSelectStatsPeriod={function() {}}
            realtimeActive={false}
            statsPeriod="24h"
          />,
          TestStubs.routerContext()
        );

        wrapper.setState({
          allInQuerySelected: false,
          anySelected: true,
          multiSelected: true,
        });

        apiMock = MockApiClient.addMockResponse({
          url: '/organizations/1337/issues/',
          method: 'PUT',
        });
        storeMock = jest
          .spyOn(SelectedGroupStore, 'getSelectedIds')
          .mockImplementation(() => new Set(['3', '6', '9']));
      });

      afterEach(function() {
        MockApiClient.clearMockResponses();
        storeMock.mockRestore();
      });

      it('sets selected items to resolved', function() {
        wrapper
          .find('ResolveActions ActionLink')
          .first()
          .simulate('click');

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

      it('sets selected items to ignored', function() {
        wrapper
          .find('IgnoreActions ActionLink')
          .first()
          .simulate('click');

        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              id: ['3', '6', '9'],
              project: [1],
            },
            data: {status: 'ignored'},
          })
        );
      });

      it('merges selected items', function() {
        wrapper
          .find('ActionLink.action-merge')
          .first()
          .simulate('click');

        // Let the modal open
        wrapper.update();

        wrapper
          .find('ActionLink.action-merge Modal Button')
          .at(1) // 0: "Cancel", 1: "Merge"
          .simulate('click');

        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              id: ['3', '6', '9'],
              project: [1],
            },
            data: {merge: 1},
          })
        );
      });

      it('sets selected items to bookmarked', function() {
        test.todo('Modal does not want to show');
        /*
        wrapper
          .find('ActionLink.action-bookmark')
          .first()
          .simulate('click');

        // Let the modal open
        wrapper.update();

        wrapper
          .find('ActionLink.action-bookmark Modal Button')
          .at(1) // 0: "Cancel", 1: "Merge"
          .simulate('click');

        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              id: ['3', '6', '9'],
              project: [1],
            },
            data: {isBookmarked: 'true'},
          })
        );
        */
      });

      it('sets selected items to assigned', function() {
        wrapper
          .find('ActionItem.action-bulk-assign AssigneeSelector Actor')
          .first()
          .simulate('mouseover');

        // Let the dropdown open
        wrapper.update();

        wrapper
          .find('ActionItem.action-bulk-assign AutoCompleteItem')
          .first()
          .simulate('click');

        expect(apiMock).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              id: ['3', '6', '9'],
              project: [1],
            },
            data: {assignedTo: 'user:1'},
          })
        );
      });
    });
  });

  describe('actionSelectedGroups()', function() {
    beforeAll(function() {
      jest.spyOn(SelectedGroupStore, 'deselectAll');
    });

    beforeEach(function() {
      SelectedGroupStore.deselectAll.mockReset();
      actions = shallow(
        <IssueListActions
          api={new MockApiClient()}
          query=""
          orgId="1337"
          projectId="1"
          selection={{
            projects: [1],
            environments: [],
            datetime: {start: null, end: null, period: null, utc: true},
          }}
          groupIds={['1', '2', '3']}
          onRealtimeChange={function() {}}
          onSelectStatsPeriod={function() {}}
          realtimeActive={false}
          statsPeriod="24h"
        />
      ).instance();
    });

    afterAll(function() {
      SelectedGroupStore.mockRestore();
    });

    describe('for all items', function() {
      it("should invoke the callback with 'undefined' and deselect all", function() {
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

    describe('for page-selected items', function() {
      it('should invoke the callback with an array of selected items and deselect all', function() {
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

  describe('missing projectId prop', function() {
    beforeEach(function() {
      wrapper = mountWithTheme(
        <IssueListActions
          api={new MockApiClient()}
          query=""
          orgId="1337"
          groupIds={['1', '2', '3']}
          selection={{
            projects: [],
            environments: [],
            datetime: {start: null, end: null, period: null, utc: true},
          }}
          onRealtimeChange={function() {}}
          onSelectStatsPeriod={function() {}}
          realtimeActive={false}
          statsPeriod="24h"
        />,
        TestStubs.routerContext()
      );
    });

    it('should disable resolve picker', function() {
      const resolve = wrapper.find('ResolveActions').first();
      expect(resolve.props().disabled).toBe(true);
      expect(resolve.props().disableDropdown).toBe(true);
    });

    it('should disable merge button', function() {
      const merge = wrapper.find('ActionLink[className~="action-merge"]').first();
      expect(merge.props().disabled).toBe(true);
    });
  });
});
