import {createRef} from 'react';
import {TeamFixture} from 'sentry-fixture/team';
import {ThemeFixture} from 'sentry-fixture/theme';

import {act, render, screen, within} from 'sentry-test/reactTestingLibrary';

import {TeamStore} from 'sentry/stores/teamStore';

import {InputSection} from './inputSection';

describe('InputSection', () => {
  it('restores user and team Actors while preserving canonical draft text', () => {
    TeamStore.loadInitialData([TeamFixture({id: '3', slug: 'infra-alerts'})]);
    const inputValue = {
      text: 'Ask @Alice Example and @infra-alerts ',
      mentions: [
        {id: 'user:1', sourceId: 'members', start: 4, end: 18, text: '@Alice Example'},
        {id: 'team:3', sourceId: 'teams', start: 23, end: 36, text: '@infra-alerts'},
      ],
    };
    const onInputChange = jest.fn();
    render(
      <InputSection
        blocks={[]}
        composerRef={createRef()}
        enabled
        inputValue={inputValue}
        onCreatePR={jest.fn()}
        onInputChange={onInputChange}
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
    expect(within(editor).getByText('Alice Example')).toBeInTheDocument();
    expect(within(editor).getByText('#infra-alerts')).toBeInTheDocument();
    expect(within(editor).getAllByTestId('letter_avatar-avatar')).toHaveLength(2);
    expect(onInputChange).not.toHaveBeenCalled();

    act(() => {
      editor.dispatchEvent(new InputEvent('input', {bubbles: true}));
    });
    expect(onInputChange).toHaveBeenCalledWith(inputValue);
    TeamStore.reset();
  });

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
