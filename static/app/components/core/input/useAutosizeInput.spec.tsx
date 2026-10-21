import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useAutosizeInput} from './useAutosizeInput';

function AutosizedInput({placeholder}: {placeholder: string}) {
  const ref = useAutosizeInput({value: '', placeholder});
  return (
    <input
      ref={ref}
      value=""
      placeholder={placeholder}
      readOnly
      style={{padding: 0, borderWidth: 0}}
    />
  );
}

describe('useAutosizeInput', () => {
  it('shrinks the input when its placeholder is removed', () => {
    const offsetWidthSpy = jest
      .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.innerText.length * 10;
      });

    try {
      const {rerender} = render(<AutosizedInput placeholder="Search" />);
      const widthWithPlaceholder = screen.getByRole('textbox').style.width;

      rerender(<AutosizedInput placeholder="" />);

      expect(widthWithPlaceholder).toBe('61px');
      expect(screen.getByRole('textbox')).toHaveStyle({width: '1px'});
    } finally {
      offsetWidthSpy.mockRestore();
    }
  });
});
