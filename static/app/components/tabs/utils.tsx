import isPropValid from '@emotion/is-prop-valid';

export const tabsShouldForwardProp = prop =>
  typeof prop === 'string' && isPropValid(prop) && prop !== 'orientation';
