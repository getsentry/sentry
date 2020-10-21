import {mountWithTheme, mount} from 'sentry-test/enzyme';

import {RadioBooleanField} from 'app/components/forms';
import NewRadioBooleanField from 'app/views/settings/components/forms/radioBooleanField';

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
        <RadioBooleanField name="fieldName" yesLabel="Yes" noLabel="No" />,
        {
          context: {
            form: {
              data: {
                fieldName: true,
              },
              errors: {},
            },
          },
        }
      );
      expect(wrapper).toSnapshot();
    });

    it('renders new field without form context', function () {
      const wrapper = mount(
        <NewRadioBooleanField name="fieldName" yesLabel="Yes" noLabel="No" />
      );
      expect(wrapper).toSnapshot();
    });

    it('can change values', function () {
      const mock = jest.fn();
      const wrapper = mount(
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
