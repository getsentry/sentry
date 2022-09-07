import {render} from 'sentry-test/reactTestingLibrary';

import QueryCount from 'sentry/components/queryCount';

describe('QueryCount', function () {
  it('displays count when no max', function () {
    const {container} = render(<QueryCount count={5} />);
    expect(container).toSnapshot();
  });
  it('displays count when count < max', function () {
    const {container} = render(<QueryCount count={5} max={500} />);
    expect(container).toSnapshot();
  });

  it('does not render if count is 0', function () {
    const {container} = render(<QueryCount count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('can render when count is 0 when `hideIfEmpty` is false', function () {
    const {container} = render(<QueryCount count={0} hideIfEmpty={false} />);
    expect(container).toSnapshot();
  });

  it('displays max count if count >= max', function () {
    const {container} = render(<QueryCount count={500} max={500} />);
    expect(container).toSnapshot();
  });
});
