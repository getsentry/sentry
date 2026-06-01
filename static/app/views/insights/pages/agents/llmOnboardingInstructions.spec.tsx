import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ManualInstrumentationNote} from './llmOnboardingInstructions';

describe('ManualInstrumentationNote', () => {
  const docsLink = <a href="https://docs.sentry.io">docs</a>;

  it('renders "Copy instructions" text', () => {
    render(<ManualInstrumentationNote docsLink={docsLink} />);

    expect(screen.getByText(/Copy instructions/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy Prompt for AI Agent'})
    ).not.toBeInTheDocument();
  });
});
