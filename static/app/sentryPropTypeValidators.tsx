/**
 * @deprecated
 */
function isObject(
  props: unknown,
  propName: string,
  _componentName: unknown
): null | Error {
  if (typeof props !== 'object' || props === null) {
    return new Error('props does not contain organization property');
  }

  if (!(propName in props)) {
    return null;
  }

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  if (!props[propName]) {
    return null;
  }

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  if (typeof props[propName] !== 'object') {
    throw new Error(`props.${propName} is not of type object`);
  }

  return null;
}
/**
 * @deprecated
 */
export const SentryPropTypeValidators = {
  isObject,
};
