export function getSelector(options = {}) {
  let selector = '';

  if (options.name) {
    selector = `[name="${options.name}"]`;
  }

  let field = `Select${options.control ? 'Control' : 'Field'}`;
  return `${field}${selector}`;
}

export function openMenu(wrapper, options = {}) {
  let selector = getSelector(options);
  wrapper.find(`${selector} input`).simulate('focus');
  wrapper.find(`${selector} .Select-control`).simulate('mouseDown', {button: 0});

  return wrapper;
}

export function findOption(wrapper, {value, label} = {}, options) {
  let selector = getSelector(options);
  let valueSelector = !!value ? 'value' : 'label';

  return wrapper
    .find(`${selector} Option`)
    .findWhere(
      el => el.prop('option') && el.prop('option')[valueSelector] === (value || label)
    );
}

export function selectByLabel(wrapper, label, options = {}) {
  openMenu(wrapper, options);
  findOption(wrapper, {label}, options).simulate('mouseDown');
}

export function selectByValue(wrapper, value, options = {}) {
  openMenu(wrapper, options);
  findOption(wrapper, {value}, options).simulate('mouseDown');
}
