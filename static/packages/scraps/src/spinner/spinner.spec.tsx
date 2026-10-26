/* oxlint-disable testing-library/no-node-access -- The decorative ring and clipping container have no accessible role. */
import {Fragment} from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';

import {Spinner} from '@sentry/scraps/spinner';
import {darkTheme, lightTheme} from '@sentry/scraps/theme';

describe('Spinner', () => {
  it('renders its message and forwards presentation overrides', () => {
    render(
      <Spinner className="custom" data-test-id="custom-loader" style={{margin: 0}}>
        Loading data
      </Spinner>
    );

    expect(screen.getByText('Loading data')).toBeInTheDocument();
    expect(screen.getByTestId('custom-loader')).toHaveClass('scraps-spinner', 'custom');
    expect(screen.getByTestId('custom-loader')).toHaveStyle({margin: '0px'});
  });

  it.each([
    [24, 23, 2],
    [44, 43, 4],
    [64, 63, 6],
    [80, 79, 6],
  ])('preserves a %ipx indicator and its border', (size, diameter, borderWidth) => {
    render(<Spinner size={size} />);

    const container = screen.getByTestId('loading-indicator').firstElementChild;
    expect(container).toHaveStyle({width: `${size}px`, height: `${size}px`});
    expect(container?.firstElementChild).toHaveStyle({
      width: `${diameter}px`,
      height: `${diameter}px`,
      borderWidth: `${borderWidth}px`,
    });
  });

  it('isolates compact and relative styles', () => {
    render(<Spinner mini relative />);

    expect(screen.getByTestId('loading-indicator')).toHaveClass(
      'scraps-spinner',
      'scraps-spinner-mini'
    );
    expect(screen.getByTestId('loading-indicator').firstElementChild).toHaveClass(
      'scraps-spinner-container',
      'scraps-spinner-relative'
    );
  });

  it('ignores legacy global loader styles', () => {
    render(
      <Fragment>
        <style>{`
          .loading, .loading-indicator-container, .loading-indicator, .loading-message {
            width: 1px !important;
            height: 1px !important;
            border-width: 20px !important;
          }
        `}</style>
        <Spinner>Loading data</Spinner>
      </Fragment>
    );

    const spinner = screen.getByTestId('loading-indicator');
    expect(spinner).not.toHaveClass('loading');
    expect(
      spinner.querySelector(
        '.loading-indicator-container, .loading-indicator, .loading-message'
      )
    ).toBeNull();
  });

  it.each([lightTheme, darkTheme])('provides its own styles in $type mode', theme => {
    render(
      <ThemeProvider theme={theme}>
        <Spinner />
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
