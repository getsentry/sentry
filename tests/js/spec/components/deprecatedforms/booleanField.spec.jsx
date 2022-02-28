import {enzymeRender} from 'sentry-test/enzyme';

import {BooleanField, Form} from 'sentry/components/deprecatedforms';

describe('BooleanField', function () {
  describe('render()', function () {
    it('renders without form context', function () {
      const wrapper = enzymeRender(<BooleanField name="fieldName" />);
      expect(wrapper).toSnapshot();
    });

    it('renders with form context', function () {
      const wrapper = enzymeRender(
        <Form initialData={{fieldName: true}}>
          <BooleanField name="fieldName" />
        </Form>
      );
      expect(wrapper).toSnapshot();
    });
  });
});
