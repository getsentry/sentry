import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import CircleIndicator from 'sentry/components/circleIndicator';

describe('CircleIndicator', function () {
  it('renders', function () {
    const {container} = mountWithTheme(<CircleIndicator />);
    expect(container).toSnapshot();
  });
});
