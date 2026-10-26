import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FeedbackItemSection} from './feedbackItemSection';

describe('FeedbackItemSection', () => {
  it('does not collapse when a header action is clicked', async () => {
    render(
      <FeedbackItemSection
        actions={<button type="button">View Full Trace</button>}
        collapsible
        sectionKey="trace-preview-test"
        title="Trace Preview"
      >
        Preview content
      </FeedbackItemSection>
    );

    await userEvent.click(screen.getByRole('button', {name: 'View Full Trace'}));

    expect(screen.getByText('Preview content')).toBeInTheDocument();
  });
});
