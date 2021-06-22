const changeReactMentionsInput = (wrapper, value) => {
  const oldActiveElement = document.activeElement;
  // Need to do this because of how react-mentions works,
  // checks that event object is === document.activeElement
  let el = wrapper.find('textarea').getDOMNode();

  // We need a non-zero width selection for `react-mentions`
  el.selectionStart = 2;
  el.selectionEnd = 3;
  wrapper.find('textarea').simulate('select', {target: el});

  // Finally update element value
  el = wrapper.find('textarea').getDOMNode();
  el.value = value;
  el.selectionEnd = value.length;

  // We need to make document.activeElement == event.target (event being the
  // change event), otherwise react-mentions will not propagate the change event
  Object.defineProperty(document, 'activeElement', {
    get() {
      return el;
    },
    configurable: true,
  });

  wrapper.find('textarea').simulate('change', {target: el});

  // reset activeElement
  Object.defineProperty(document, 'activeElement', {
    get() {
      return oldActiveElement;
    },
    configurable: true,
  });
};

export default changeReactMentionsInput;
