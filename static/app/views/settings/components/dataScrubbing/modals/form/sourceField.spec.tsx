import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SourceField} from 'sentry/views/settings/components/dataScrubbing/modals/form/sourceField';
import {
  binarySuggestions,
  unarySuggestions,
  valueSuggestions,
} from 'sentry/views/settings/components/dataScrubbing/utils';

const defaultFieldProps = {
  'aria-describedby': 'source-hint',
  'aria-invalid': false,
  disabled: false,
  id: 'source',
  name: 'source',
  onBlur: jest.fn(),
};

describe('Source', () => {
  it('default render', () => {
    render(
      <SourceField
        fieldProps={defaultFieldProps}
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={jest.fn()}
        value="$string"
      />
    );

    expect(screen.getByRole('textbox', {name: 'Source'})).toHaveValue('$string');
  });

  it('display defaultSuggestions if input is empty and focused', async () => {
    render(
      <SourceField
        fieldProps={defaultFieldProps}
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

  it('display defaultSuggestions if input is empty, focused and has length 3', async () => {
    render(
      <SourceField
        fieldProps={defaultFieldProps}
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

  it('display binaryOperatorSuggestions if penultimateFieldValue has type string', async () => {
    render(
      <SourceField
        fieldProps={defaultFieldProps}
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

  it('display defaultSuggestions + unaryOperatorSuggestions, if penultimateFieldValue has type binary', async () => {
    render(
      <SourceField
        fieldProps={defaultFieldProps}
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

  it('display binaryOperatorSuggestions if penultimateFieldValue has type value', async () => {
    render(
      <SourceField
        fieldProps={defaultFieldProps}
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
        fieldProps={defaultFieldProps}
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
        fieldProps={defaultFieldProps}
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

  it('click on a suggestion should be possible', async () => {
    const handleOnChange = jest.fn();

    render(
      <SourceField
        fieldProps={defaultFieldProps}
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

  it('suggestions keyDown and keyUp should work', async () => {
    const handleOnChange = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();

    render(
      <SourceField
        fieldProps={defaultFieldProps}
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

  it('pressing Enter does not crash when suggestions are not visible', async () => {
    const handleOnChange = jest.fn();

    render(
      <SourceField
        fieldProps={defaultFieldProps}
        isRegExMatchesSelected={false}
        suggestions={valueSuggestions}
        onChange={handleOnChange}
        value="$string"
      />
    );

    const input = screen.getByRole('textbox', {name: 'Source'});

    // Focus the input to show suggestions, then select one to close the dropdown
    await userEvent.click(input);
    await userEvent.keyboard('{Enter}');

    // Suggestions dropdown should now be hidden after selecting
    expect(screen.queryByTestId('source-suggestions')).not.toBeInTheDocument();

    // Pressing Enter again with suggestions hidden should not crash
    await userEvent.keyboard('{Enter}');
  });

  it('pressing Enter allows form submission when suggestions are not visible', async () => {
    Element.prototype.scrollIntoView = jest.fn();
    const handleSubmit = jest.fn(e => e.preventDefault());

    render(
      <form onSubmit={handleSubmit}>
        <SourceField
          fieldProps={defaultFieldProps}
          isRegExMatchesSelected={false}
          suggestions={valueSuggestions}
          onChange={jest.fn()}
          value="foo "
        />
        <button type="submit">Submit</button>
      </form>
    );

    const input = screen.getByRole('textbox', {name: 'Source'});

    // Open suggestions and select one via Enter — this should NOT submit the form
    await userEvent.click(input);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(handleSubmit).not.toHaveBeenCalled();

    // Suggestions should now be hidden
    expect(screen.queryByTestId('source-suggestions')).not.toBeInTheDocument();

    // Press Enter again with suggestions hidden — this SHOULD submit the form
    await userEvent.click(input);
    await userEvent.keyboard('{Enter}');
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('pressing Enter to select a suggestion does not submit the parent form', async () => {
    const handleOnChange = jest.fn();
    const handleSubmit = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();

    render(
      <form onSubmit={handleSubmit}>
        <SourceField
          fieldProps={defaultFieldProps}
          isRegExMatchesSelected={false}
          suggestions={valueSuggestions}
          onChange={handleOnChange}
          value="foo "
        />
      </form>
    );

    await userEvent.click(screen.getByRole('textbox', {name: 'Source'}));
    await userEvent.keyboard('{ArrowDown}{Enter}');

    // Suggestion was selected
    expect(handleOnChange).toHaveBeenCalledWith('foo ||');
    // Form was NOT submitted
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
// trivial change for CI testing
