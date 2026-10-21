import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AnnotatedTextErrors} from 'sentry/components/events/meta/annotatedText/annotatedTextErrors';

describe('AnnotatedTextErrors', () => {
  it('shows the error kind and reason in the tooltip', async () => {
    render(
      <AnnotatedTextErrors errors={[['invalid_data', {reason: 'value too long'}]]} />
    );

    await userEvent.hover(screen.getByTestId('annotated-text-error-icon'));

    expect(await screen.findByText('Invalid data')).toBeInTheDocument();
    expect(screen.getByText('Value too long')).toBeInTheDocument();
  });

  it('shows a plain error kind in the tooltip', async () => {
    render(<AnnotatedTextErrors errors={['invalid_data']} />);

    await userEvent.hover(screen.getByTestId('annotated-text-error-icon'));

    expect(await screen.findByText('Invalid data')).toBeInTheDocument();
  });
});
