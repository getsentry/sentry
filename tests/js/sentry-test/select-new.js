export function getSelector(options = {}) {
  let selector = '';

  if (options.selector) {
    return options.selector;
  }

  if (options.name) {
    selector = `[name="${options.name}"]`;
  }

  const field = `Select${options.control ? 'Control' : 'Field'}`;
  return `${field}${selector}`;
}

export function openMenu(wrapper, options = {}) {
  const selector = getSelector(options);
  const control = wrapper.find(`${selector} SelectContainer Control`).at(options.at || 0);
  control.prop('innerProps').onMouseDown({target: {tagName: 'INPUT'}});
  control.find('input').simulate('focus');

  return wrapper;
}

export function clearValue(wrapper) {
  wrapper.find('.Select-clear-zone').simulate('mouseDown', {button: 0});
}

export function findOption(wrapper, {value, label} = {}, options) {
  const selector = getSelector(options);
  const valueSelector = !!value ? 'value' : 'label';
  return wrapper.find(`${selector} Option[${valueSelector}="${value || label}"]`);
}

export function selectByLabel(wrapper, label, options = {}) {
  openMenu(wrapper, options);
  findOption(wrapper, {label}, options)
    .at(options.at || 0)
    .simulate('click');
}

export function selectByValue(wrapper, value, options = {}) {
  openMenu(wrapper, options);
  findOption(wrapper, {value}, options)
    .at(options.at || 0)
    .simulate('click');
}

//used for the text input to replicate a user typing
export function changeInputValue(element, value) {
  element.instance().value = value;
  element.simulate('change', {target: {value}});
}
