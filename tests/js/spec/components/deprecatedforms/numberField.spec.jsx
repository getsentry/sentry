import {mountWithTheme} from 'sentry-test/enzyme';

import {NumberField} from 'sentry/components/deprecatedforms';
import Form from 'sentry/components/deprecatedforms/form';

describe('NumberField', function () {
  describe('render()', function () {
    it('renders', function () {
      const wrapper = mountWithTheme(<NumberField name="fieldName" />);
      expect(wrapper).toSnapshot();
    });

    it('renders with optional attributes', function () {
      const wrapper = mountWithTheme(<NumberField name="fieldName" min={0} max={100} />);
      expect(wrapper).toSnapshot();
    });

    it('renders with value', function () {
      const wrapper = mountWithTheme(<NumberField name="fieldName" value={5} />);
      expect(wrapper).toSnapshot();
    });

    it('renders with form context', function () {
      const wrapper = mountWithTheme(
        <Form initialData={{fieldName: 5}}>
          <NumberField name="fieldName" />
        </Form>
      );
      expect(wrapper).toSnapshot();
    });

    it('doesnt save `NaN` when new value is empty string', function () {
      const wrapper = mountWithTheme(
        <Form onSubmit={() => {}}>
          <NumberField name="fieldName" defaultValue="2" />
        </Form>
      );
      wrapper.find('input').simulate('change', {target: {value: ''}});
      expect(wrapper.state('data').fieldName).toBe('');
    });
  });
});
