const jq = {
  tooltip: () => jq,
  on: () => jq,
  off: () => jq,
  unbind: () => jq,
  ajaxError: () => jq,
  simpleSlider: () => jq,
  addClass: () => jq,
  find: () => jq,
} as Partial<JQuery>;

const jqMock = () => jq;

export default jqMock;
