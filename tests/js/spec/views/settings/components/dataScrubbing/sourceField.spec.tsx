import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import SourceField from 'app/views/settings/components/dataScrubbing/modals/form/sourceField';
import {
  binarySuggestions,
  unarySuggestions,
  valueSuggestions,
} from 'app/views/settings/components/dataScrubbing/utils';

function renderComponent({
  value = '$string',
  onChange = jest.fn(),
  ...props
}: Partial<SourceField['props']>) {
  return mountWithTheme(
    <SourceField
      isRegExMatchesSelected={false}
      suggestions={valueSuggestions}
      onChange={onChange}
      value={value}
      {...props}
    />
  );
}

describe('Source', () => {
  it('default render', () => {
    const wrapper = renderComponent({});
    expect(wrapper.find('input').prop('value')).toBe('$string');
  });

  it('display defaultSuggestions if input is empty and focused', () => {
    const wrapper = renderComponent({value: ''});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="source-suggestions"]')
      .hostNodes()
      .children();

    // [...defaultSuggestions, ...unaryOperatorSuggestions].length === 18
    expect(suggestions).toHaveLength(18);
  });

  it('display defaultSuggestions if input is empty, focused and has length 3', () => {
    const wrapper = renderComponent({value: '   '});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="source-suggestions"]')
      .hostNodes()
      .children();

    // [...defaultSuggestions, ...unaryOperatorSuggestions].length === 18
    expect(suggestions).toHaveLength(18);
  });

  it('display binaryOperatorSuggestions if penultimateFieldValue has type string', () => {
    const wrapper = renderComponent({value: 'foo '});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="source-suggestions"]')
      .hostNodes()
      .children();

    // binaryOperatorSuggestions.length === 2
    expect(suggestions).toHaveLength(2);
    // &&
    expect(suggestions.at(0).text()).toEqual(binarySuggestions[0].value);
    // ||
    expect(suggestions.at(1).text()).toEqual(binarySuggestions[1].value);
  });

  it('display defaultSuggestions + unaryOperatorSuggestions, if penultimateFieldValue has type binary', () => {
    const wrapper = renderComponent({value: 'foo && '});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="source-suggestions"]')
      .hostNodes()
      .children();

    // [...defaultSuggestions, ...unaryOperatorSuggestions].length === 18
    expect(suggestions).toHaveLength(18);
    // !
    expect(suggestions.at(17).text()).toEqual(unarySuggestions[0].value);
  });

  it('display binaryOperatorSuggestions if penultimateFieldValue has type value', () => {
    const wrapper = renderComponent({value: 'foo && $string '});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="source-suggestions"]')
      .hostNodes()
      .children();

    // binaryOperatorSuggestions.length === 2
    expect(suggestions).toHaveLength(2);
    // &&
    expect(suggestions.at(0).text()).toEqual(binarySuggestions[0].value);
    // ||
    expect(suggestions.at(1).text()).toEqual(binarySuggestions[1].value);
  });

  it('display binaryOperatorSuggestions if penultimateFieldValue is of typeof Array', () => {
    const wrapper = renderComponent({value: 'foo && !$string '});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="source-suggestions"]')
      .hostNodes()
      .children();

    // binaryOperatorSuggestions.length === 2
    expect(suggestions).toHaveLength(2);
    // &&
    expect(suggestions.at(0).text()).toEqual(binarySuggestions[0].value);
    // ||
    expect(suggestions.at(1).text()).toEqual(binarySuggestions[1].value);
  });

  it('display defaultSuggestions if penultimateFieldValue has type unary', () => {
    const wrapper = renderComponent({value: 'foo && !'});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="source-suggestions"]')
      .hostNodes()
      .children();

    // defaultSuggestions.length === 17
    expect(suggestions).toHaveLength(17);

    // everywhere
    expect(suggestions.at(0).text()).toEqual(
      `${valueSuggestions[0].value}(${valueSuggestions[0].description})`
    );
  });

  it('click on a suggestion should be possible', () => {
    const handleOnChange = jest.fn();
    const wrapper = renderComponent({value: 'foo && ', onChange: handleOnChange});

    // makes showSuggestions === true
    wrapper.find('input').simulate('focus');

    const suggestions = wrapper
      .find('[data-test-id="source-suggestions"]')
      .hostNodes()
      .children();

    suggestions.at(1).simulate('click');
    expect(wrapper.state().fieldValues[2].value).toBe(valueSuggestions[1].value);
  });

  it('suggestions keyDown and keyUp should work', () => {
    const handleOnChange = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();
    const wrapper = renderComponent({value: 'foo ', onChange: handleOnChange});
    const input = wrapper.find('input');

    // makes showSuggestions === true
    input.simulate('focus');

    const suggestions = wrapper
      .find('[data-test-id="source-suggestions"]')
      .hostNodes()
      .children();

    expect(suggestions).toHaveLength(2);

    expect(suggestions.at(0).prop('active')).toBe(true);

    input.simulate('keyDown', {keyCode: 40});
    expect(wrapper.state().activeSuggestion).toBe(1);
    input.simulate('keyDown', {keyCode: 13});
    expect(wrapper.state().activeSuggestion).toBe(0);
    expect(wrapper.state().fieldValues[1].value).toBe('||');

    expect(handleOnChange).toHaveBeenCalledWith('foo ||');

    input.simulate('change', {target: {value: 'foo || '}});
    input
      .simulate('keyDown', {keyCode: 40})
      .simulate('keyDown', {keyCode: 40})
      .simulate('keyDown', {keyCode: 38});
    expect(wrapper.state().activeSuggestion).toBe(1);
  });
});
