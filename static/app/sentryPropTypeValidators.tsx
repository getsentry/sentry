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

  if (!props[propName]) {
    return null;
  }

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
