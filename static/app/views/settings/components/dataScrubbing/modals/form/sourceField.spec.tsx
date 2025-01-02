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

  it('display defaultSuggestions if input is empty and focused', async function () {
    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={jest.fn()}
        value=""
      />
    );

    await userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');

    // [...defaultSuggestions, ...unaryOperatorSuggestions].length === 18
    expect(suggestions).toHaveLength(18);
  });

  it('display defaultSuggestions if input is empty, focused and has length 3', async function () {
    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={jest.fn()}
        value="   "
      />
    );

    await userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');

    // [...defaultSuggestions, ...unaryOperatorSuggestions].length === 18
    expect(suggestions).toHaveLength(18);
  });

  it('display binaryOperatorSuggestions if penultimateFieldValue has type string', async function () {
    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={jest.fn()}
        value="foo "
      />
    );

    await userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');

    // binaryOperatorSuggestions.length === 2
    expect(suggestions).toHaveLength(2);
    // &&
    expect(suggestions[0]).toHaveTextContent(binarySuggestions[0]!.value);
    // ||
    expect(suggestions[1]).toHaveTextContent(binarySuggestions[1]!.value);
  });

  it('display defaultSuggestions + unaryOperatorSuggestions, if penultimateFieldValue has type binary', async function () {
    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={jest.fn()}
        value="foo && "
      />
    );

    await userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');

    // [...defaultSuggestions, ...unaryOperatorSuggestions].length === 18
    expect(suggestions).toHaveLength(18);
    // !
    expect(suggestions[17]).toHaveTextContent(unarySuggestions[0]!.value);
  });

  it('display binaryOperatorSuggestions if penultimateFieldValue has type value', async function () {
    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={jest.fn()}
        value="foo && $string "
      />
    );

    await userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');

    // binaryOperatorSuggestions.length === 2
    expect(suggestions).toHaveLength(2);
    // &&
    expect(suggestions[0]).toHaveTextContent(binarySuggestions[0]!.value);
    // ||
    expect(suggestions[1]).toHaveTextContent(binarySuggestions[1]!.value);
  });

  it('display binaryOperatorSuggestions if penultimateFieldValue is of typeof Array', async () => {
    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={jest.fn()}
        value="foo && !$string "
      />
    );

    await userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');

    // binaryOperatorSuggestions.length === 2
    expect(suggestions).toHaveLength(2);
    // &&
    expect(suggestions[0]).toHaveTextContent(binarySuggestions[0]!.value);
    // ||
    expect(suggestions[1]).toHaveTextContent(binarySuggestions[1]!.value);
  });

  it('display defaultSuggestions if penultimateFieldValue has type unary', async () => {
    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={jest.fn()}
        value="foo && !"
      />
    );

    await userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');

    // defaultSuggestions.length === 17
    expect(suggestions).toHaveLength(17);

    // everywhere
    expect(suggestions[0]).toHaveTextContent(
      `${valueSuggestions[0]!.value}(${valueSuggestions[0]!.description})`
    );
  });

  it('click on a suggestion should be possible', async function () {
    const handleOnChange = jest.fn();

    render(
      <SourceField
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={handleOnChange}
        value="foo && "
      />
    );

    await userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');

    await userEvent.click(suggestions[1]!);

    expect(handleOnChange).toHaveBeenCalledWith('foo && password');
  });

  it('suggestions keyDown and keyUp should work', async function () {
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
    await userEvent.click(screen.getByRole('textbox', {name: 'Source'}));

    const suggestions = screen.getAllByRole('listitem');
    expect(suggestions).toHaveLength(2);

    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(handleOnChange).toHaveBeenNthCalledWith(1, 'foo ||');

    await userEvent.type(screen.getByRole('textbox', {name: 'Source'}), ' ');

    expect(handleOnChange).toHaveBeenNthCalledWith(2, 'foo  ');

    await userEvent.keyboard('{ArrowDown}{ArrowUp}{Enter}');

    expect(handleOnChange).toHaveBeenNthCalledWith(3, 'foo &&');
  });
});
