import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {BooleanField, Form} from 'sentry/components/deprecatedforms';

describe('BooleanField', function () {
  it('renders without form context', function () {
    const wrapper = render(<BooleanField name="fieldName" />);
    expect(wrapper.container).toSnapshot();
  });

  it('renders with form context', function () {
    const wrapper = render(
      <Form initialData={{fieldName: true}}>
        <BooleanField name="fieldName" />
      </Form>
    );
    expect(wrapper.container).toSnapshot();
  });

  it('toggles', function () {
    const onChange = jest.fn();
    render(<BooleanField name="fieldName" onChange={onChange} />);

    userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);
    userEvent.click(screen.getByRole('checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
