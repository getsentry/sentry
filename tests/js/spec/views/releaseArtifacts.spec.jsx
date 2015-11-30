import React from 'react';
import TestUtils from 'react-addons-test-utils';

import Api from 'app/api';
import ReleaseArtifacts from 'app/views/releaseArtifacts';
import Pagination from 'app/components/pagination';

import stubReactComponents from '../../helpers/stubReactComponent';

describe('ReleaseArtifacts', function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.stubbedApiRequest = this.sandbox.stub(Api, 'request');
    stubReactComponents(this.sandbox, [Pagination]);

  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('fetchData()', function() {
    it('should append the location query string to the request URL', function() {
      TestUtils.renderIntoDocument(
        <ReleaseArtifacts
          location={{query: {cursor: '0:0:100'}}}
          params={{orgId: '123', projectId: '456', version: 'abcdef'}}/>
      );

      let apiArgs = this.stubbedApiRequest.lastCall.args;
      expect(apiArgs[0]).to.eql('/projects/123/456/releases/abcdef/files/');
      expect(apiArgs[1].data).to.have.property('cursor', '0:0:100');
    });
  });
});
