import React from 'react';

import DataPrivacyRulesPanelSelectorField from 'app/views/settings/components/dataPrivacyRulesPanel/dataPrivacyRulesPanelSelectorField';
import {
  binaryOperatorSuggestions,
  unaryOperatorSuggestions,
} from 'app/views/settings/components/dataPrivacyRulesPanel/dataPrivacyRulesPanelSelectorFieldTypes';
import {mountWithTheme} from 'sentry-test/enzyme';

function renderComponent({
  value = '$string',
  onChange = jest.fn(),
  ...props
}: Partial<DataPrivacyRulesPanelSelectorField['props']>) {
  return mountWithTheme(
    <DataPrivacyRulesPanelSelectorField
      selectorSuggestions={[]}
      onChange={onChange}
      value={value}
      {...props}
    />
  );
}

describe('DataPrivacyRulesPanelSelectorField', () => {
  it('default render', () => {
    const wrapper = renderComponent({});
    expect(wrapper.find('input').prop('value')).toBe('$string');
    expect(wrapper).toMatchSnapshot();
  });

  it('display initialSelectors if input empty and focused', () => {
    const wrapper = renderComponent({value: ''});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="panelSelectorField-suggestions"]')
      .hostNodes()
      .children();

    // [...valueSuggestions, ...unaryOperatorSuggestions].length === 16
    expect(suggestions).toHaveLength(16);
  });

  it('display binaryOperatorSuggestions if penultimateFieldValue has type string', () => {
    const wrapper = renderComponent({value: 'foo '});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="panelSelectorField-suggestions"]')
      .hostNodes()
      .children();

    // binaryOperatorSuggestions.length === 2
    expect(suggestions).toHaveLength(2);
    // &&
    expect(suggestions.at(0).text()).toEqual(binaryOperatorSuggestions[0].value);
    // ||
    expect(suggestions.at(1).text()).toEqual(binaryOperatorSuggestions[1].value);
  });

  it('display initialSelectors if penultimateFieldValue has type binary', () => {
    const wrapper = renderComponent({value: 'foo && '});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="panelSelectorField-suggestions"]')
      .hostNodes()
      .children();

    // initialSelectors.length === 16
    expect(suggestions).toHaveLength(16);
    // !
    expect(suggestions.at(15).text()).toEqual(unaryOperatorSuggestions[0].value);
  });

  it('display binaryOperatorSuggestions if penultimateFieldValue has type value', () => {
    const wrapper = renderComponent({value: 'foo && $string '});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="panelSelectorField-suggestions"]')
      .hostNodes()
      .children();

    // binaryOperatorSuggestions.length === 2
    expect(suggestions).toHaveLength(2);
    // &&
    expect(suggestions.at(0).text()).toEqual(binaryOperatorSuggestions[0].value);
    // ||
    expect(suggestions.at(1).text()).toEqual(binaryOperatorSuggestions[1].value);
  });

  it('display binaryOperatorSuggestions if penultimateFieldValue is of typeof Array', () => {
    const wrapper = renderComponent({value: 'foo && !$string '});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="panelSelectorField-suggestions"]')
      .hostNodes()
      .children();

    // binaryOperatorSuggestions.length === 2
    expect(suggestions).toHaveLength(2);
    // &&
    expect(suggestions.at(0).text()).toEqual(binaryOperatorSuggestions[0].value);
    // ||
    expect(suggestions.at(1).text()).toEqual(binaryOperatorSuggestions[1].value);
  });

  it('display valueSuggestions if penultimateFieldValue has type unary', () => {
    const wrapper = renderComponent({value: 'foo && !'});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="panelSelectorField-suggestions"]')
      .hostNodes()
      .children();

    // valueSuggestions.length === 15
    expect(suggestions).toHaveLength(15);
    // $string
    expect(suggestions.at(0).text()).toEqual('$string(Any string value)');
  });

  it('click on a suggestion should be possible', () => {
    const handleOnChange = jest.fn();
    const wrapper = renderComponent({value: 'foo && ', onChange: handleOnChange});

    // makes showSuggestions === true
    wrapper.find('input').simulate('focus');

    const suggestions = wrapper
      .find('[data-test-id="panelSelectorField-suggestions"]')
      .hostNodes()
      .children();

    suggestions.at(1).simulate('click');
    expect(wrapper.state().fieldValues[2].value).toBe('$number');
  });

  it('suggestions keyDown and keyUp should work', () => {
    const handleOnChange = jest.fn();
    Element.prototype.scrollIntoView = jest.fn();
    const wrapper = renderComponent({value: 'foo ', onChange: handleOnChange});
    const input = wrapper.find('input');

    // makes showSuggestions === true
    input.simulate('focus');

    const suggestions = wrapper
      .find('[data-test-id="panelSelectorField-suggestions"]')
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
