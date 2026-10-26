import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';

import {lightTheme} from '@sentry/scraps/theme';

import {useAutosizeInput} from './useAutosizeInput';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

function AutosizeInput({placeholder, value}: {value: string; placeholder?: string}) {
  const autosizeRef = useAutosizeInput({value, placeholder});
  return (
    <input
      data-test-id="autosize-input"
      ref={autosizeRef}
      value={value}
      placeholder={placeholder}
      onChange={() => {}}
      style={{padding: '0px', borderWidth: '0px'}}
    />
  );
}

describe('useAutosizeInput', () => {
  beforeEach(() => {
    // jsdom has no layout, so size the measuring div by its text length
    jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
      this: HTMLElement
    ) {
      return (this.innerText ?? '').length * 10;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resizes controlled values and removes the sizing element on unmount', () => {
    const {rerender, unmount, container} = render(<AutosizeInput value="old" />, {
      wrapper: ThemeWrapper,
    });
    expect(screen.getByRole('textbox')).toHaveStyle({width: '31px'});
    // The sizing element is intentionally invisible to accessibility queries.
    // oxlint-disable-next-line testing-library/no-node-access
    const sizingElement = document.body.lastElementChild;
    expect(sizingElement).not.toBe(container);
    rerender(<AutosizeInput value="longer" />);
    expect(screen.getByRole('textbox')).toHaveStyle({width: '61px'});
    unmount();
    expect(sizingElement).not.toBeInTheDocument();
  });

  it('sizes an empty input to its placeholder', () => {
    render(<AutosizeInput value="" placeholder="placeholder" />, {wrapper: ThemeWrapper});

    expect(screen.getByTestId('autosize-input')).toHaveStyle({width: '111px'});
  });

  it('resizes when the placeholder is removed without a value change', () => {
    const {rerender} = render(<AutosizeInput value="" placeholder="placeholder" />, {
      wrapper: ThemeWrapper,
    });
    expect(screen.getByTestId('autosize-input')).toHaveStyle({width: '111px'});

    rerender(<AutosizeInput value="" />);

    expect(screen.getByTestId('autosize-input')).toHaveStyle({width: '1px'});
  });
});
