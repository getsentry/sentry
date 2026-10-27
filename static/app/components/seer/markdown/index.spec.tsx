import * as Sentry from '@sentry/react';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

import {SeerMarkdown} from 'sentry/components/seer/markdown';

jest.mock('sentry/components/charts/baseChart', () => ({
  BaseChart: jest.fn(() => null),
}));

const CHART = `{% chart %}${JSON.stringify({
  title: 'Error volume',
  visualization: 'line',
  x_axis: 'time',
  series: [
    {
      label: 'Errors',
      data: [
        {x: '2026-07-30T12:00:00Z', y: 12},
        {x: '2026-07-30T13:00:00Z', y: 18},
      ],
    },
  ],
})}{% /chart %}`;

function renderWithLeadingEmbedActions(raw: string) {
  const release = jest.fn();
  const onClaim = jest.fn(() => release);
  const result = render(
    <SeerMarkdown
      raw={raw}
      leadingEmbedActions={{actions: <Button>Block actions</Button>, onClaim}}
    />
  );
  return {...result, onClaim, release};
}

describe('SeerMarkdown', () => {
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

  describe('leadingEmbedActions', () => {
    it('puts them in the header of the embed the message opens with', () => {
      const {onClaim, release, unmount} = renderWithLeadingEmbedActions(
        `${CHART}\n\nErrors returned to baseline.`
      );

      expect(
        within(screen.getByTestId('seer-chart-embed')).getByRole('button', {
          name: 'Block actions',
        })
      ).toBeInTheDocument();
      expect(onClaim).toHaveBeenCalledTimes(1);

      unmount();
      expect(release).toHaveBeenCalledTimes(1);
    });

    it('leaves them to the host when the message opens with prose', () => {
      const {onClaim} = renderWithLeadingEmbedActions(`Errors spiked.\n\n${CHART}`);

      expect(screen.getByTestId('seer-chart-embed')).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Block actions'})
      ).not.toBeInTheDocument();
      expect(onClaim).not.toHaveBeenCalled();
    });

    it('leaves them to the host when the opening embed has no card', () => {
      const {onClaim} = renderWithLeadingEmbedActions(
        '{% dsn %}{"value":"https://key@o0.ingest.sentry.io/0"}{% /dsn %}'
      );

      expect(
        screen.queryByRole('button', {name: 'Block actions'})
      ).not.toBeInTheDocument();
      expect(onClaim).not.toHaveBeenCalled();
    });
  });
});
