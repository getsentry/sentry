import React from 'react';

import DataPrivacyRulesPanelSelectorField from 'app/views/settings/components/dataPrivacyRulesPanel/dataPrivacyRulesPanelForm/dataPrivacyRulesPanelFormSelectorField';
import {
  binaryOperatorSuggestions,
  unaryOperatorSuggestions,
  defaultSuggestions,
} from 'app/views/settings/components/dataPrivacyRulesPanel/dataPrivacyRulesPanelForm/dataPrivacyRulesPanelFormSelectorFieldSuggestions';
import {mountWithTheme} from 'sentry-test/enzyme';

function renderComponent({
  value = '$string',
  onChange = jest.fn(),
  ...props
}: Partial<DataPrivacyRulesPanelSelectorField['props']>) {
  return mountWithTheme(
    <DataPrivacyRulesPanelSelectorField
      selectorSuggestions={defaultSuggestions}
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

  it('display defaultSuggestions if input is empty and focused', () => {
    const wrapper = renderComponent({value: ''});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="panelSelectorField-suggestions"]')
      .hostNodes()
      .children();

    // [...defaultSuggestions, ...unaryOperatorSuggestions].length === 12
    expect(suggestions).toHaveLength(12);
  });

  it('display defaultSuggestions if input is empty, focused and has length 3', () => {
    const wrapper = renderComponent({value: '   '});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="panelSelectorField-suggestions"]')
      .hostNodes()
      .children();

    // [...defaultSuggestions, ...unaryOperatorSuggestions].length === 12
    expect(suggestions).toHaveLength(12);
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

  it('display defaultSuggestions + unaryOperatorSuggestions, if penultimateFieldValue has type binary', () => {
    const wrapper = renderComponent({value: 'foo && '});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="panelSelectorField-suggestions"]')
      .hostNodes()
      .children();

    // [...defaultSuggestions, ...unaryOperatorSuggestions].length === 12
    expect(suggestions).toHaveLength(12);
    // !
    expect(suggestions.at(11).text()).toEqual(unaryOperatorSuggestions[0].value);
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

  it('display defaultSuggestions if penultimateFieldValue has type unary', () => {
    const wrapper = renderComponent({value: 'foo && !'});
    wrapper.find('input').simulate('focus');
    const suggestions = wrapper
      .find('[data-test-id="panelSelectorField-suggestions"]')
      .hostNodes()
      .children();

    // defaultSuggestions.length === 11
    expect(suggestions).toHaveLength(11);

    // everywhere
    expect(suggestions.at(0).text()).toEqual(
      `${defaultSuggestions[0].value}(${defaultSuggestions[0].description})`
    );
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
    expect(wrapper.state().fieldValues[2].value).toBe(defaultSuggestions[1].value);
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
