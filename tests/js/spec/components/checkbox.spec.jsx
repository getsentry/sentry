import {mountWithTheme} from 'sentry-test/enzyme';

import Checkbox from 'app/components/checkbox';

describe('Checkbox', function () {
  it('renders', function () {
    const component = mountWithTheme(<Checkbox onChange={() => {}} />);

    expect(component).toSnapshot();
  });
});
