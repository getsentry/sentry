import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import BooleanField from 'sentry/components/deprecatedforms/booleanField';
import Form from 'sentry/components/deprecatedforms/form';

describe('BooleanField', function () {
  it('renders without form context', function () {
    render(<BooleanField name="fieldName" />);
  });

  it('renders with form context', function () {
    render(
      <Form initialData={{fieldName: true}}>
        <BooleanField name="fieldName" />
      </Form>
    );
  });

  it('toggles', async function () {
    const onChange = jest.fn();
    render(<BooleanField name="fieldName" onChange={onChange} />);

    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
