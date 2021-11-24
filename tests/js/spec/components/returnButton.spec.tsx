import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import ReturnButton from 'sentry/views/settings/components/forms/returnButton';

describe('returnButton', function () {
  it('renders', function () {
    const {container} = mountWithTheme(<ReturnButton />);
    expect(container).toSnapshot();
  });
});
