/* oxlint-disable testing-library/no-node-access -- The decorative ring and clipping container have no accessible role. */
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';

import {LoadingIndicator} from '@sentry/scraps/loadingIndicator';
import {darkTheme, lightTheme} from '@sentry/scraps/theme';

describe('LoadingIndicator', () => {
  it('renders its message and forwards presentation overrides', () => {
    render(
      <LoadingIndicator
        className="custom"
        data-test-id="custom-loader"
        style={{margin: 0}}
      >
        Loading data
      </LoadingIndicator>
    );

    expect(screen.getByText('Loading data')).toBeInTheDocument();
    expect(screen.getByTestId('custom-loader')).toHaveClass('loading', 'custom');
    expect(screen.getByTestId('custom-loader')).toHaveStyle({margin: '0px'});
  });

  it.each([
    [24, 23, 2],
    [44, 43, 4],
    [64, 63, 6],
    [80, 79, 6],
  ])('preserves a %ipx indicator and its border', (size, diameter, borderWidth) => {
    render(<LoadingIndicator size={size} />);

    const container = screen.getByTestId('loading-indicator').firstElementChild;
    expect(container).toHaveStyle({width: `${size}px`, height: `${size}px`});
    expect(container?.firstElementChild).toHaveStyle({
      width: `${diameter}px`,
      height: `${diameter}px`,
      borderWidth: `${borderWidth}px`,
    });
  });

  it('retains mini and relative class hooks', () => {
    render(<LoadingIndicator mini relative />);

    expect(screen.getByTestId('loading-indicator')).toHaveClass('loading', 'mini');
    expect(screen.getByTestId('loading-indicator').firstElementChild).toHaveClass(
      'loading-indicator-container',
      'relative'
    );
  });

  it.each([lightTheme, darkTheme])('provides its own styles in $type mode', theme => {
    render(
      <ThemeProvider theme={theme}>
        <LoadingIndicator />
      </ThemeProvider>
    );

    const container = screen.getByTestId('loading-indicator').firstElementChild;
    const indicator = container?.firstElementChild;
    expect(container).toHaveStyle({padding: '0.5px', overflow: 'hidden'});
    expect(indicator).toHaveStyle({
      'border-width': '6px',
      background: 'transparent',
    });
    expect(indicator).toHaveStyle({
      'border-left-color':
        theme.type === 'dark' ? theme.tokens.border.accent.vibrant : '#6c5fc7',
    });
  });
});
