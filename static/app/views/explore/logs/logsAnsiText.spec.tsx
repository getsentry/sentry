import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LogsAnsiColorsProvider} from 'sentry/views/explore/logs/logsAnsiColors';
import {LogsAnsiText} from 'sentry/views/explore/logs/logsAnsiText';

const COLORED_TEXT = '\u001B[31mdanger\u001B[0m plain';

function renderWithQuery(query: Record<string, string>) {
  return render(
    <LogsAnsiColorsProvider rows={[]}>
      <LogsAnsiText text={COLORED_TEXT} />
    </LogsAnsiColorsProvider>,
    {
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/explore/logs/', query},
      },
    }
  );
}

describe('LogsAnsiText', () => {
  it('strips the escape codes when no opacity is set', () => {
    const {container} = renderWithQuery({});

    expect(screen.getByText('danger plain')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('color-mix');
  });

  it('strips the escape codes when the page toggle is available but switched off', () => {
    const {container} = renderWithQuery({logsPageToggle: '1'});

    expect(screen.getByText('danger plain')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('color-mix');
  });

  it('blends the terminal color into the body text color when opacity is set', () => {
    renderWithQuery({logsColorOpacity: '50'});

    // jsdom drops the percentage when it reserializes color-mix, so it can't be asserted here.
    expect(screen.getByText('danger').style.color).toContain('color-mix(in srgb,');
  });
});
