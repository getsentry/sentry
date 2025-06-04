import isPropValid from '@emotion/is-prop-valid';

export const tabsShouldForwardProp = (prop: string) =>
  typeof prop === 'string' && isPropValid(prop) && prop !== 'orientation';
