import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {NumberField} from 'sentry/components/deprecatedforms';
import Form from 'sentry/components/deprecatedforms/form';

describe('NumberField', function () {
  describe('render()', function () {
    it('renders', function () {
      const wrapper = render(<NumberField name="fieldName" />);
      expect(wrapper.container).toSnapshot();
    });

    it('renders with optional attributes', function () {
      const wrapper = render(<NumberField name="fieldName" min={0} max={100} />);
      expect(wrapper.container).toSnapshot();
    });

    it('renders with value', function () {
      render(<NumberField name="fieldName" value={5} />);
      expect(screen.getByRole('spinbutton')).toHaveValue(5);
    });

    it('renders with form context', function () {
      render(
        <Form initialData={{fieldName: 5}}>
          <NumberField name="fieldName" />
        </Form>
      );
      expect(screen.getByRole('spinbutton')).toHaveValue(5);
    });

    it('doesnt save `NaN` when new value is empty string', function () {
      render(
        <Form initialData={{fieldName: 5}}>
          <NumberField name="fieldName" defaultValue="5" />
        </Form>
      );

      expect(screen.getByRole('spinbutton')).toHaveValue(5);

      userEvent.clear(screen.getByRole('spinbutton'));
      expect(screen.getByRole('spinbutton')).toHaveValue(null);
    });
  });
});
