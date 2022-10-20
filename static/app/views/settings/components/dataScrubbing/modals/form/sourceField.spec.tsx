import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SourceField from 'sentry/views/settings/components/dataScrubbing/modals/form/sourceField';
import {
  binarySuggestions,
  unarySuggestions,
  valueSuggestions,
} from 'sentry/views/settings/components/dataScrubbing/utils';

describe('Source', function () {
  it('default render', function () {
    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={jest.fn()}
        value="$string"
      />
    );

    expect(screen.getByRole('textbox', {name: 'Source'})).toHaveValue('$string');
  });

  it('display defaultSuggestions if input is empty and focused', function () {
    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={jest.fn()}
        value=""
      />
    );

    userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');

    // [...defaultSuggestions, ...unaryOperatorSuggestions].length === 18
    expect(suggestions).toHaveLength(18);
  });

  it('display defaultSuggestions if input is empty, focused and has length 3', function () {
    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={jest.fn()}
        value="   "
      />
    );

    userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');

    // [...defaultSuggestions, ...unaryOperatorSuggestions].length === 18
    expect(suggestions).toHaveLength(18);
  });

  it('display binaryOperatorSuggestions if penultimateFieldValue has type string', function () {
    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={jest.fn()}
        value="foo "
      />
    );

    userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');

    // binaryOperatorSuggestions.length === 2
    expect(suggestions).toHaveLength(2);
    // &&
    expect(suggestions[0]).toHaveTextContent(binarySuggestions[0].value);
    // ||
    expect(suggestions[1]).toHaveTextContent(binarySuggestions[1].value);
  });

  it('display defaultSuggestions + unaryOperatorSuggestions, if penultimateFieldValue has type binary', function () {
    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={jest.fn()}
        value="foo && "
      />
    );

    userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');

    // [...defaultSuggestions, ...unaryOperatorSuggestions].length === 18
    expect(suggestions).toHaveLength(18);
    // !
    expect(suggestions[17]).toHaveTextContent(unarySuggestions[0].value);
  });

  it('display binaryOperatorSuggestions if penultimateFieldValue has type value', function () {
    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={jest.fn()}
        value="foo && $string "
      />
    );

    userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');

    // binaryOperatorSuggestions.length === 2
    expect(suggestions).toHaveLength(2);
    // &&
    expect(suggestions[0]).toHaveTextContent(binarySuggestions[0].value);
    // ||
    expect(suggestions[1]).toHaveTextContent(binarySuggestions[1].value);
  });

  it('display binaryOperatorSuggestions if penultimateFieldValue is of typeof Array', () => {
    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={jest.fn()}
        value="foo && !$string "
      />
    );

    userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');

    // binaryOperatorSuggestions.length === 2
    expect(suggestions).toHaveLength(2);
    // &&
    expect(suggestions[0]).toHaveTextContent(binarySuggestions[0].value);
    // ||
    expect(suggestions[1]).toHaveTextContent(binarySuggestions[1].value);
  });

  it('display defaultSuggestions if penultimateFieldValue has type unary', () => {
    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={jest.fn()}
        value="foo && !"
      />
    );

    userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');

    // defaultSuggestions.length === 17
    expect(suggestions).toHaveLength(17);

    // everywhere
    expect(suggestions[0]).toHaveTextContent(
      `${valueSuggestions[0].value}(${valueSuggestions[0].description})`
    );
  });

  it('click on a suggestion should be possible', function () {
    const handleOnChange = jest.fn();

    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={handleOnChange}
        value="foo && "
      />
    );

    userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');

    userEvent.click(suggestions[1]);

    expect(handleOnChange).toHaveBeenCalledWith('foo && password');
  });

  it('suggestions keyDown and keyUp should work', function () {
    const handleOnChange = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();

    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={handleOnChange}
        value="foo "
      />
    );

    // makes showSuggestions === true
    userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');
    expect(suggestions).toHaveLength(2);

    userEvent.keyboard('{arrowdown}{enter}');
    expect(handleOnChange).toHaveBeenNthCalledWith(1, 'foo ||');

    userEvent.type(screen.getByRole('textbox', {name: 'Source'}), ' ');

    expect(handleOnChange).toHaveBeenNthCalledWith(2, 'foo  ');

    userEvent.keyboard('{arrowdown}{arrowup}{enter}');

    expect(handleOnChange).toHaveBeenNthCalledWith(3, 'foo &&');
  });
});
