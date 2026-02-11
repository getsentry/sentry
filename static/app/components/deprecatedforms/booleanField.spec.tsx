import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import BooleanField from 'sentry/components/deprecatedforms/booleanField';
import Form from 'sentry/components/deprecatedforms/form';

describe('BooleanField', () => {
  it('renders without form context', () => {
    render(<BooleanField name="fieldName" />);
  });

  it('renders with form context', () => {
    render(
      <Form initialData={{fieldName: true}}>
        <BooleanField name="fieldName" />
      </Form>
    );
  });

  it('toggles', async () => {
    const onChange = jest.fn();
    render(<BooleanField name="fieldName" onChange={onChange} />);

    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
