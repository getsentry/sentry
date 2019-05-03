const changeReactMentionsInput = (wrapper, value) => {
  // Need to do this because of how react-mentions works,
  // checks that event object is === document.activeElement
  let el = wrapper.find('textarea').getDOMNode();

  // tbh idk what i'm doing here, i think we need these 2 values to be differe different
  el.selectionStart = 2;
  el.selectionEnd = 3;
  wrapper.find('textarea').simulate('select', {target: el});

  // Finally update element value
  el = wrapper.find('textarea').getDOMNode();
  el.value = value;
  el.selectionEnd = value.length;
  wrapper.find('textarea').simulate('change', {target: el});
};

export default changeReactMentionsInput;
