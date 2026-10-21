import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useAutosizeInput} from './useAutosizeInput';

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

  it('sizes an empty input to its placeholder', () => {
    render(<AutosizeInput value="" placeholder="placeholder" />);

    expect(screen.getByTestId('autosize-input')).toHaveStyle({width: '111px'});
  });

  it('resizes when the placeholder is removed without a value change', () => {
    const {rerender} = render(<AutosizeInput value="" placeholder="placeholder" />);
    expect(screen.getByTestId('autosize-input')).toHaveStyle({width: '111px'});

    rerender(<AutosizeInput value="" />);

    expect(screen.getByTestId('autosize-input')).toHaveStyle({width: '1px'});
  });
});
