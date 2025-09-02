import {render} from 'sentry-test/reactTestingLibrary';

import SplitDiff from 'sentry/components/splitDiff';

describe('SplitDiff', () => {
  beforeEach(() => {});

  afterEach(() => {});

  it('renders', () => {
    render(<SplitDiff base="restaurant" target="aura" />);
  });

  it('renders with newlines', () => {
    const base = `this is my restaurant
    and restaurant
    common`;
    const target = `aura
    and your aura
    common`;
    render(<SplitDiff base={base} target={target} />);
  });
});
