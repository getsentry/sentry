export function getSelector(options = {}) {
  let selector = '';

  if (options.name) {
    selector = `[name="${options.name}"]`;
  }

  const field = `Select${options.control ? 'Control' : 'Field'}`;
  return `${field}${selector}`;
}

export function openMenu(wrapper, options = {}) {
  const selector = getSelector(options);
  wrapper
    .find(`${selector} input[role="combobox"]`)
    .at(options.at || 0)
    .simulate('focus');
  wrapper
    .find(`${selector} .Select-control`)
    .at(options.at || 0)
    .simulate('mouseDown', {button: 0});

  return wrapper;
}

export function clearValue(wrapper) {
  wrapper.find('.Select-clear-zone').simulate('mouseDown', {button: 0});
}

export function findOption(wrapper, {value, label} = {}, options) {
  const selector = getSelector(options);
  const valueSelector = !!value ? 'value' : 'label';

  return wrapper
    .find(`${selector} Option`)
    .findWhere(
      el => el.prop('option') && el.prop('option')[valueSelector] === (value || label)
    );
}

export function selectByLabel(wrapper, label, options = {}) {
  openMenu(wrapper, options);
  findOption(wrapper, {label}, options)
    .at(options.at || 0)
    .simulate('mouseDown');
}

export function selectByValue(wrapper, value, options = {}) {
  openMenu(wrapper, options);
  findOption(wrapper, {value}, options)
    .at(options.at || 0)
    .simulate('mouseDown');
}
