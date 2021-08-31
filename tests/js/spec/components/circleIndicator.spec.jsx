import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import CircleIndicator from 'app/components/circleIndicator';

describe('CircleIndicator', function () {
  it('renders', function () {
    const {container} = mountWithTheme(<CircleIndicator />);
    expect(container).toSnapshot();
  });
});
