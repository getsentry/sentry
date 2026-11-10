import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';

import {lightTheme} from '@sentry/scraps/theme';

import {Input} from '.';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('Input', () => {
  it('maps nativeSize to size', () => {
    render(<Input size="md" nativeSize={5} />, {wrapper: ThemeWrapper});

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('size', '5');
  });
});
