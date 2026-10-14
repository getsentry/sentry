import {render, screen} from 'sentry-test/reactTestingLibrary';

import {KeyValueTableCard} from 'sentry/components/tables/keyValueTable';

describe('KeyValueTableCard', () => {
  it('renders children when given no content items', () => {
    render(<KeyValueTableCard title="Body">{'Free-form content'}</KeyValueTableCard>);

    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Free-form content')).toBeInTheDocument();
  });

  it('renders nothing when given neither content items nor children', () => {
    const {container} = render(<KeyValueTableCard title="Body" />);

    expect(container).toBeEmptyDOMElement();
  });
});
