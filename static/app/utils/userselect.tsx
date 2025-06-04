export type UserSelectValues = {
  MozUserSelect: string | null;
  msUserSelect: string | null;
  userSelect: string | null;
  webkitUserSelect: string | null;
};

export const setBodyUserSelect = (nextValues: UserSelectValues): UserSelectValues => {
  // NOTE: Vendor prefixes other than `ms` should begin with a capital letter.
  // ref: https://reactjs.org/docs/dom-elements.html#style

  const previousValues = {
    userSelect: document.body.style.userSelect,
    // MozUserSelect is not typed in TS
    // @ts-expect-error TS(2339): Property 'MozUserSelect' does not exist on type 'C... Remove this comment to see the full error message
    MozUserSelect: document.body.style.MozUserSelect,
    // msUserSelect is not typed in TS
    // @ts-expect-error TS(2551): Property 'msUserSelect' does not exist on type 'CS... Remove this comment to see the full error message
    msUserSelect: document.body.style.msUserSelect,
    webkitUserSelect: document.body.style.webkitUserSelect,
  };

  document.body.style.userSelect = nextValues.userSelect || '';
  // MozUserSelect is not typed in TS
  // @ts-expect-error TS(2339): Property 'MozUserSelect' does not exist on type 'C... Remove this comment to see the full error message
  document.body.style.MozUserSelect = nextValues.MozUserSelect || '';
  // msUserSelect is not typed in TS
  // @ts-expect-error TS(2551): Property 'msUserSelect' does not exist on type 'CS... Remove this comment to see the full error message
  document.body.style.msUserSelect = nextValues.msUserSelect || '';
  document.body.style.webkitUserSelect = nextValues.webkitUserSelect || '';

  return previousValues;
};
