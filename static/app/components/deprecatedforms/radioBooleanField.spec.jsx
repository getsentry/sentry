import {render} from 'sentry-test/reactTestingLibrary';

import {Form, RadioBooleanField} from 'sentry/components/deprecatedforms';

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
});
