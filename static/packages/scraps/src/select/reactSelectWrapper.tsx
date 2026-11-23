/* eslint-disable no-restricted-imports */
import ReactSelectModule, {components} from 'react-select';
import type CreatableComponent from 'react-select/creatable';
import CreatableModule from 'react-select/creatable/dist/react-select.cjs.js';

// react-select 4 publishes both CommonJS and ESM. Node-oriented bundlers can
// preserve the CommonJS default wrapper, while browser builds use the component.
function unwrapDefault<T>(value: T | {default: T}): T {
  return typeof value === 'object' && value !== null && 'default' in value
    ? value.default
    : value;
}

const ReactSelect = unwrapDefault(ReactSelectModule);
const Creatable: typeof CreatableComponent = unwrapDefault(CreatableModule);

// This file is a thin wrapper around react-select that removes defaultProps from functional components
// They are not supported in react 19

// Make shallow copy of default props and re-use in wrapper
const reactSelectDefaultProps = {...ReactSelect.defaultProps};
// @ts-expect-error remove default props for react 19
ReactSelect.defaultProps = undefined;
// @ts-expect-error remove default props for react 19
components.MultiValue.defaultProps = undefined;
// @ts-expect-error remove default props for react 19
components.NoOptionsMessage.defaultProps = undefined;
// @ts-expect-error remove default props for react 19
components.LoadingMessage.defaultProps = undefined;
// @ts-expect-error remove default props for react 19
components.LoadingIndicator.defaultProps = undefined;

// oxlint-disable-next-line react/function-component-definition -- This typed wrapper must remain a named function expression.
const ReactSelectWrapper = function ReactSelectWrapperComponent({ref, ...props}: any) {
  // Reapply default props to the component
  return (
    <ReactSelect {...reactSelectDefaultProps} {...props} ref={ref} menuPlacement="auto" />
  );
} as any as typeof ReactSelect;

export {ReactSelectWrapper as ReactSelect, Creatable, components};
export {createFilter, mergeStyles} from 'react-select';
export type {
  NamedProps as Props,
  StylesConfig,
  OptionsType,
  ValueType,
} from 'react-select';
