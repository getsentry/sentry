import {forwardRef} from 'react';
import ReactSelect, {
  components as selectComponents,
  createFilter,
  mergeStyles,
  type Props as ReactSelectProps,
} from 'react-select';

import type {SelectValue} from 'sentry/types/core';

// Make shallow copy of default props and re-use in wrapper
const reactSelectDefaultProps = {...ReactSelect.defaultProps};
// @ts-expect-error remove default props for react 19
ReactSelect.defaultProps = undefined;
// @ts-expect-error remove default props for react 19
selectComponents.MultiValue.defaultProps = undefined;
// @ts-expect-error remove default props for react 19
selectComponents.NoOptionsMessage.defaultProps = undefined;
// @ts-expect-error remove default props for react 19
selectComponents.LoadingMessage.defaultProps = undefined;
// @ts-expect-error remove default props for react 19
selectComponents.LoadingIndicator.defaultProps = undefined;

const ReactSelectWrapper = forwardRef<ReactSelect<SelectValue<any>>, ReactSelectProps>(
  (props, ref) => {
    // Reapply default props to the component
    return <ReactSelect {...reactSelectDefaultProps} {...props} ref={ref as any} />;
  }
) as any as typeof ReactSelect;

export {ReactSelectWrapper as ReactSelect, selectComponents, createFilter, mergeStyles};
