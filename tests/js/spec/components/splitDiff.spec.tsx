import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import SplitDiff from 'sentry/components/splitDiff';

describe('SplitDiff', function () {
  beforeEach(function () {});

  afterEach(function () {});

  it('renders', function () {
    const {container} = mountWithTheme(<SplitDiff base="restaurant" target="aura" />);
    expect(container).toSnapshot();
  });

  it('renders with newlines', function () {
    const base = `this is my restaurant
    and restaurant
    common`;
    const target = `aura
    and your aura
    common`;
    const {container} = mountWithTheme(<SplitDiff base={base} target={target} />);
    expect(container).toSnapshot();
  });
});
