import {mountWithTheme} from 'sentry-test/enzyme';

import {Form, RadioBooleanField} from 'sentry/components/deprecatedforms';
import NewRadioBooleanField from 'sentry/components/forms/radioBooleanField';

describe('RadioBooleanField', function () {
  describe('render()', function () {
    it('renders without form context', function () {
      const wrapper = mountWithTheme(
        <RadioBooleanField name="fieldName" yesLabel="Yes" noLabel="No" />
      );
      expect(wrapper).toSnapshot();
    });

    it('renders with form context', function () {
      const wrapper = mountWithTheme(
        <Form initialData={{fieldName: true}}>
          <RadioBooleanField name="fieldName" yesLabel="Yes" noLabel="No" />
        </Form>
      );
      expect(wrapper).toSnapshot();
    });

    it('renders new field without form context', function () {
      const wrapper = mountWithTheme(
        <NewRadioBooleanField name="fieldName" yesLabel="Yes" noLabel="No" />
      );
      expect(wrapper).toSnapshot();
    });

    it('can change values', function () {
      const mock = jest.fn();
      const wrapper = mountWithTheme(
        <NewRadioBooleanField
          onChange={mock}
          name="fieldName"
          yesLabel="Yes"
          noLabel="No"
        />
      );

      wrapper.find('input[value="true"]').simulate('change');
      expect(mock).toHaveBeenCalledWith(true, expect.anything());

      wrapper.find('input[value="false"]').simulate('change');
      expect(mock).toHaveBeenCalledWith(false, expect.anything());
    });
  });
});
