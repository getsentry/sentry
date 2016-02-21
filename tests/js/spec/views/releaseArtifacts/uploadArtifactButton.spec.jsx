import React from 'react';
import {shallow} from 'enzyme';

import UploadArtifactButton from 'app/views/releaseArtifacts/uploadArtifactButton';

describe('UploadArtifactButton', function () {
  beforeEach(function () {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    this.sandbox.restore();
  });

  describe('render()', function () {
    it('should render a link and a modal', function () {
      let wrapper = shallow(<UploadArtifactButton orgId="1337" projectId="2448" version="abcdef" onUpload={()=>{}}/>);

      expect(wrapper.find('a.btn')).to.have.length(1);
      expect(wrapper.find('Modal')).to.have.length(1);
    });
  });

  describe('handleSubmit()', function () {
    it('should make an XHR POST, call the onUpload callback, and hide the modal', function () {
      let onUpload = this.sandbox.stub();
      let wrapper = shallow(<UploadArtifactButton orgId="1337" projectId="2448" version="abcdef" onUpload={onUpload}/>);
      wrapper.setState({modalVisible: true});

      let instance = wrapper.instance();

      this.sandbox.stub(instance.api, 'request', function (url, options) {
        expect(options.data instanceof FormData);
        options.success({
          id: 'fileid'
        });
        options.complete();
      });

      instance.handleSubmit({preventDefault: () => {}});

      expect(instance.api.request.calledOnce).to.be.true;
      expect(onUpload.calledOnce).to.be.true;
      expect(onUpload.getCall(0).args[0]).to.have.property('id', 'fileid');
      expect(wrapper.state('modalVisible')).to.be.false;
    });
  });
});
