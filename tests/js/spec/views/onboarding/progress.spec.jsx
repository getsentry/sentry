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

    const baseContext = {
      context: {
        organization: {id: '1337', slug: 'testOrg'},
      },
    };

    it('should render step 0 if no projectId', function() {
      let wrapper = shallow(<ProgressNodes {...baseProps} />, baseContext);

      expect(wrapper.find('.node')).toHaveLength(6);
      expect(wrapper.find('.active')).toHaveLength(2);
      expect(
        wrapper
          .find('.active')
          .first()
          .last()
          .text()
      ).toEqual('Tell us about your project');

      expect(wrapper.find('.done')).toHaveLength(2);

      expect(wrapper).toMatchSnapshot();
    });

    it('should render step 1 if has projectId', function() {
      let props = {
        ...baseProps,
        params: {
          projectId: 'my-cool-project',
        },
      };

      let wrapper = shallow(<ProgressNodes {...props} />, baseContext);

      expect(wrapper.find('.node')).toHaveLength(6);
      expect(wrapper.find('.active')).toHaveLength(2);
      expect(
        wrapper
          .find('.active')
          .first()
          .last()
          .text()
      ).toEqual('Configure your application and send an event');

      expect(wrapper.find('.done')).toHaveLength(4);

      expect(wrapper).toMatchSnapshot();
    });
  });
});
