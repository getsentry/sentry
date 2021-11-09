import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import Checkbox from 'app/components/checkbox';

describe('Checkbox', function () {
  it('renders', function () {
    const {container} = mountWithTheme(<Checkbox onChange={() => {}} />);

    expect(container).toSnapshot();
  });
});
