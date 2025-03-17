/* eslint-disable no-restricted-imports */
import {forwardRef} from 'react';
import ReactSelect, {components} from 'react-select';

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

const ReactSelectWrapper = forwardRef(function ReactSelectWrapper(props: any, ref) {
  // Reapply default props to the component
  return <ReactSelect {...reactSelectDefaultProps} {...props} ref={ref as any} />;
}) as any as typeof ReactSelect;

export {ReactSelectWrapper as ReactSelect, ReactSelectWrapper as default, components};
// biome-ignore lint/performance/noBarrelFile: not really a barrel file per say
export {createFilter, mergeStyles} from 'react-select';
export type {
  Props,
  StylesConfig,
  SingleValueProps,
  GroupedOptionsType,
  MultiValueProps,
  OptionsType,
  OptionTypeBase,
  ValueType,
} from 'react-select';
