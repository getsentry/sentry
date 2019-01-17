import React from 'react';
import {shallow} from 'enzyme';

import ProgressNodes from 'app/views/onboarding/progress';

describe('ProgressNodes', function() {
  describe('render()', function() {
    const baseProps = {
      params: {
        projectId: '',
      },
    };

    it('should render step 0 if no projectId', function() {
      let baseContext = {
        context: {
          organization: {id: '1337', slug: 'testOrg', experiments: {}},
          location: {pathname: 'http://onboarding/lol/', query: {}},
        },
      };
      let wrapper = shallow(<ProgressNodes {...baseProps} />, baseContext);

      expect(wrapper.find('[data-test-id="node"]')).toHaveLength(3);
      expect(wrapper.find('[data-test-id="node"]').find({active: true})).toHaveLength(1);
      expect(
        wrapper
          .find('[data-test-id="node"]')
          .find({active: true})
          .find('[data-test-id="node-description"]')
          .children()
          .text()
      ).toEqual('Tell us about your project');

      expect(wrapper.find('[data-test-id="node"]').find({done: true})).toHaveLength(1);

      expect(wrapper).toMatchSnapshot();
    });

    it('should render step 1 if has projectId', function() {
      let baseContext = {
        context: {
          organization: {id: '1337', slug: 'testOrg', experiments: {}},
          location: {
            pathname: 'http://onboarding/lol/projectSlug/configure/platform/',
            query: {},
          },
        },
      };
      let props = {
        ...baseProps,
        params: {
          projectId: 'my-cool-project',
        },
      };

      let wrapper = shallow(<ProgressNodes {...props} />, baseContext);

      expect(wrapper.find('[data-test-id="node"]')).toHaveLength(3);
      expect(wrapper.find('[data-test-id="node"]').find({active: true})).toHaveLength(1);
      expect(
        wrapper
          .find('[data-test-id="node"]')
          .find({active: true})
          .find('[data-test-id="node-description"]')
          .children()
          .text()
      ).toEqual('Configure your application and send an event');

      expect(wrapper.find('[data-test-id="node"]').find({done: true})).toHaveLength(2);

      expect(wrapper).toMatchSnapshot();
    });
  });
});
