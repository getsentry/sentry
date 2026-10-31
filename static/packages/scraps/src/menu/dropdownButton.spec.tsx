import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';

import {lightTheme} from '@sentry/scraps/theme';

import {DropdownButton} from './dropdownButton';

describe('DropdownButton', () => {
  it('forwards icon and busy props to Button', () => {
    render(
      <ThemeProvider theme={lightTheme}>
        <DropdownButton busy icon={<svg data-test-id="dropdown-icon" />}>
          Save
        </DropdownButton>
      </ThemeProvider>
    );

    expect(screen.getByTestId('dropdown-icon')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save'})).toHaveAttribute(
      'aria-busy',
      'true'
    );
  });
});
