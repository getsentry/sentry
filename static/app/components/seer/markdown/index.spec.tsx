import * as Sentry from '@sentry/react';

import {render} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';

describe('SeerMarkdown', () => {
  it('renders tool summaries as invisible embeds without reporting them', () => {
    const captureException = jest.spyOn(Sentry, 'captureException');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const {container} = render(
      <SeerMarkdown raw="Before {% tool_summary %}Checking the latest issue{% /tool_summary %} after" />
    );

    expect(container).toHaveTextContent('Before after');
    expect(container).not.toHaveTextContent('Checking the latest issue');
    expect(captureException).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();

    captureException.mockRestore();
    warn.mockRestore();
  });

  it('drops unknown embed tags and reports them', () => {
    const captureException = jest.spyOn(Sentry, 'captureException');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const raw = 'Before {% unknown-embed %}{"id":"1"}{% /unknown-embed %} after';
    const {container} = render(<SeerMarkdown raw={raw} />);

    expect(container).toHaveTextContent(/Before/);
    expect(container).toHaveTextContent(/after/);
    expect(container).not.toHaveTextContent(/unknown-embed/);

    if (process.env.NODE_ENV === 'development') {
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[Markdown] no renderer for tag: unknown-embed'),
        expect.anything()
      );
      expect(captureException).not.toHaveBeenCalled();
    } else {
      expect(captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '[Markdown] no renderer for tag: unknown-embed',
        })
      );
    }

    captureException.mockRestore();
    warn.mockRestore();
  });
});
