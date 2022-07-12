import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Form, RadioBooleanField} from 'sentry/components/deprecatedforms';
import NewRadioBooleanField from 'sentry/components/forms/radioBooleanField';

describe('RadioBooleanField', function () {
  it('renders without form context', function () {
    const wrapper = render(
      <RadioBooleanField name="fieldName" yesLabel="Yes" noLabel="No" />
    );
    expect(wrapper.container).toSnapshot();
  });

  it('renders with form context', function () {
    const wrapper = render(
      <Form initialData={{fieldName: true}}>
        <RadioBooleanField name="fieldName" yesLabel="Yes" noLabel="No" />
      </Form>
    );
    expect(wrapper.container).toSnapshot();
  });

  it('renders new field without form context', function () {
    const wrapper = render(
      <NewRadioBooleanField name="fieldName" yesLabel="Yes" noLabel="No" />
    );
    expect(wrapper.container).toSnapshot();
  });

  it('can change values', function () {
    const changeMock = jest.fn();
    const blurMock = jest.fn();
    render(
      <NewRadioBooleanField
        onChange={changeMock}
        onBlur={blurMock}
        name="fieldName"
        yesLabel="Yes"
        noLabel="No"
      />
    );

    userEvent.click(screen.getByRole('radio', {name: 'Yes'}));
    expect(changeMock).toHaveBeenCalledWith(true, expect.anything());

    userEvent.click(screen.getByRole('radio', {name: 'No'}));
    expect(changeMock).toHaveBeenCalledWith(false, expect.anything());

    expect(blurMock).toHaveBeenCalledTimes(2);
  });
});
