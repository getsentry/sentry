import {render} from 'sentry-test/reactTestingLibrary';

import SplitDiff from 'sentry/components/splitDiff';

describe('SplitDiff', function () {
  beforeEach(function () {});

  afterEach(function () {});

  it('renders', function () {
    render(<SplitDiff base="restaurant" target="aura" />);
  });

  it('renders with newlines', function () {
    const base = `this is my restaurant
    and restaurant
    common`;
    const target = `aura
    and your aura
    common`;
    render(<SplitDiff base={base} target={target} />);
  });
});
