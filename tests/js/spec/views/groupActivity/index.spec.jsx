import React from 'react';
import {shallow} from 'enzyme';

import GroupActivity from 'app/views/groupActivity';
import NoteInput from 'app/components/activity/noteInput';
import ConfigStore from 'app/stores/configStore';
import GroupStore from 'app/stores/groupStore';

describe('GroupActivity', function() {
  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.sandbox.stub(ConfigStore, 'get').withArgs('user').returns({});
  });

  afterEach(function () {
    this.sandbox.restore();
  });

  it('renders a NoteInput', function () {
    let wrapper = shallow(<GroupActivity group={{id: '1337', activity: []}}/>, {
      context: {
        group: {id: '1337'},
        project: {id: 'foo'},
        team: {id: '1'},
        organization: {id:'bar'}
      }
    });
    expect(wrapper.find(NoteInput)).to.have.length(1);
  });

  describe('onNoteDelete()', function () {
    beforeEach(function () {
      this.instance = shallow(<GroupActivity group={{id: '1337', activity: []}}/>, {
        context: {
          group: {id: '1337'},
          project: {id: 'foo'},
          team: {id: '1'},
          organization: {id:'bar'}
        }
      }).instance();
    });

    it('should do nothing if not present in GroupStore', function () {
      let instance = this.instance;

      this.sandbox.stub(GroupStore, 'removeActivity').returns(-1); // not found
      let request = this.sandbox.stub(instance.api, 'request');

      instance.onNoteDelete({id: 1});
      expect(request.calledOnce).to.not.be.ok;
    });

    it('should remove remove the item from the GroupStore make a DELETE API request', function () {
      let instance = this.instance;

      this.sandbox.stub(GroupStore, 'removeActivity').returns(1);

      let request = this.sandbox.stub(instance.api, 'request');
      instance.onNoteDelete({id: 1});
      expect(request.calledOnce).to.be.ok;
      expect(request.getCall(0).args[0]).to.equal('/issues/1337/comments/1/');
      expect(request.getCall(0).args[1]).to.have.property('method', 'DELETE');
    });
  });
});
