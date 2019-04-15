import React from 'react';
import {shallow} from 'enzyme';

import {GroupActivity} from 'app/views/groupDetails/shared/groupActivity';
import NoteInput from 'app/components/activity/noteInput';
import ConfigStore from 'app/stores/configStore';
import GroupStore from 'app/stores/groupStore';

describe('GroupActivity', function() {
  beforeEach(function() {
    jest.spyOn(ConfigStore, 'get').mockImplementation(key => {
      if (key === 'user') {
        return {
          id: '123',
        };
      }
      return {};
    });
  });

  afterEach(function() {});

  it('renders a NoteInput', function() {
    const wrapper = shallow(
      <GroupActivity
        api={new MockApiClient()}
        group={{id: '1337', activity: []}}
        organization={TestStubs.Organization()}
      />,
      {
        context: {
          group: {id: '1337'},
          project: TestStubs.Project(),
          team: {id: '1'},
          organization: {id: 'bar'},
        },
      }
    );
    expect(wrapper.find(NoteInput)).toHaveLength(1);
  });

  describe('onNoteDelete()', function() {
    let instance;

    beforeEach(function() {
      instance = shallow(
        <GroupActivity
          api={new MockApiClient()}
          group={{id: '1337', activity: []}}
          organization={TestStubs.Organization()}
        />,
        {
          context: {
            group: {id: '1337'},
            project: TestStubs.Project(),
            team: {id: '1'},
            organization: {id: 'bar'},
          },
        }
      ).instance();
    });

    it('should do nothing if not present in GroupStore', function() {
      jest.spyOn(GroupStore, 'removeActivity').mockImplementation(() => -1); // not found
      const request = jest.spyOn(instance.props.api, 'request');

      instance.onNoteDelete({id: 1});
      expect(request.calledOnce).not.toBeTruthy();
    });

    it('should remove remove the item from the GroupStore make a DELETE API request', function() {
      const mock = MockApiClient.addMockResponse({
        url: '/issues/1337/comments/1/',
        method: 'DELETE',
      });
      jest.spyOn(GroupStore, 'removeActivity').mockImplementation(() => 1);

      instance.onNoteDelete({id: 1});
      expect(mock).toHaveBeenCalledTimes(1);
    });
  });
});
