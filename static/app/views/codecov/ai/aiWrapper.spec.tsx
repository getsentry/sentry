import {render, screen} from 'sentry-test/reactTestingLibrary';

import AIPageWrapper from 'sentry/views/codecov/ai/aiWrapper';

describe('AIPageWrapper', () => {
  it('renders the AI page title', () => {
    render(<AIPageWrapper />);

    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('renders the new feature badge', () => {
    render(<AIPageWrapper />);

    expect(screen.getByText('New')).toBeInTheDocument();
  });
});
