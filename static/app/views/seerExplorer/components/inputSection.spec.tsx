import {createRef} from 'react';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {InputSection} from './inputSection';

describe('InputSection', () => {
  it('styles the interrupted placeholder with the warning color', () => {
    render(
      <InputSection
        blocks={[]}
        composerRef={createRef()}
        enabled
        inputValue={{text: '', mentions: []}}
        interruptState="completed"
        onCreatePR={jest.fn()}
        onInputChange={jest.fn()}
        onInputClick={jest.fn()}
        onInterrupt={jest.fn()}
        onKeyDown={jest.fn()}
        onPRWidgetClick={jest.fn()}
        onSend={jest.fn()}
        prWidgetButtonRef={createRef()}
        repoPRStates={{}}
      />
    );

    const editor = screen.getByRole('combobox', {name: 'Ask Seer a question'});
    expect(editor).toHaveAttribute(
      'data-placeholder',
      'Interrupted. What should Seer do instead?'
    );
    const placeholderRules = Array.from(document.styleSheets)
      .flatMap(sheet => Array.from(sheet.cssRules))
      .filter(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule &&
          rule.selectorText.endsWith(':empty::before') &&
          editor.matches(rule.selectorText.replace('::before', ''))
      );
    const expectedStyle = document.createElement('div').style;
    expectedStyle.color = ThemeFixture().tokens.content.warning;
    expect(placeholderRules.at(-1)?.style.color).toBe(expectedStyle.color);
  });
});
