import {render, screen} from 'sentry-test/reactTestingLibrary';

import AIPageWrapper from 'sentry/views/codecov/ai/aiWrapper';

describe('AIPageWrapper', function () {
  it('renders the AI page title', function () {
    render(<AIPageWrapper />);

    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('renders the new feature badge', function () {
    render(<AIPageWrapper />);

    expect(screen.getByText('New')).toBeInTheDocument();
  });
});
