import React from 'react';
import {shallow, mount} from 'enzyme';

import {Client} from 'app/api';
import Configure from 'app/views/onboarding/configure';
import SentryTypes from '../../../../../../src/sentry/static/sentry/app/proptypes';

describe('Configure should render correctly', function() {
  let sandbox;
  let stubbedApiRequest;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    stubbedApiRequest = sandbox.stub(Client.prototype, 'request');
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('render()', function() {
    const baseProps = {
      next: () => {},
      params: {
        projectId: 'testProject',
        orgId: 'testOrg',
      },
    };

    it("shouldn't redirect for a found platform", function() {
      let props = {
        ...baseProps,
      };
      props.params.platform = 'node';

      let wrapper = shallow(<Configure {...props} />, {
        context: {organization: {id: '1337', slug: 'testOrg', teams: [['testProject']]}},
        childContextTypes: {organization: SentryTypes.Organization},
      });

      const component = wrapper.instance();

      let handleSubmitStub = sandbox.stub(component, 'redirectToNeutralDocs', () => {});

      wrapper.update();
      expect(wrapper).toMatchSnapshot();
      expect(handleSubmitStub.callCount).toEqual(0);
    });

    it('should redirect to if no matching platform', function() {
      let props = {
        ...baseProps,
      };
      props.params.platform = 'other';

      let handleSubmitStub = sandbox.stub(Configure.prototype, 'redirectToNeutralDocs');

      // 👺 ⚠️ this is a hack to defeat the method auto binding so we can fully stub the method. It would not be neccessary with es6 class components and it relies on react internals so it's fragile - maxbittker
      const index =
        Configure.prototype.__reactAutoBindPairs.indexOf('redirectToNeutralDocs') + 1;
      Configure.prototype.__reactAutoBindPairs[index] = handleSubmitStub;

      let wrapper = shallow(<Configure {...props} />, {
        context: {
          organization: {
            id: '1337',
            slug: 'testOrg',
            teams: [['testProject']],
          },
        },
      });

      expect(wrapper).toMatchSnapshot();
      expect(handleSubmitStub.callCount).toEqual(1);
    });

    it('should render platform docs', function() {
      let props = {
        ...baseProps,
      };
      props.params.platform = 'node';

      let wrapper = mount(<Configure {...props} />, {
        context: {
          organization: {
            id: '1337',
            slug: 'testOrg',
            projects: [
              {
                name: 'Test Project',
                slug: 'testProject',
                id: 'testProject',
                hasAccess: true,
                teams: [
                  {
                    id: 'coolteam',
                    hasAccess: true,
                  },
                ],
              },
            ],
            teams: [
              {
                id: 'coolteam',
                hasAccess: true,
                projects: [
                  {
                    name: 'Test Project',
                    slug: 'testProject',
                    id: 'testProject',
                  },
                ],
              },
            ],
          },
        },
        childContextTypes: {organization: SentryTypes.Organization},
      });
      expect(wrapper).toMatchSnapshot();
      expect(stubbedApiRequest.callCount).toEqual(5);
    });
  });
});
