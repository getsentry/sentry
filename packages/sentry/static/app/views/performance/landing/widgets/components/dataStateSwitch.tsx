import {Fragment} from 'react';

export function DataStateSwitch(props: {
  dataComponents: JSX.Element[];
  emptyComponent: JSX.Element;
  errorComponent: JSX.Element;

  hasData: boolean;
  isErrored: boolean;
  isLoading: boolean;
  loadingComponent?: JSX.Element;
}): JSX.Element {
  if (props.isErrored) {
    return props.errorComponent;
  }
  if (props.isLoading && props.loadingComponent) {
    return props.loadingComponent;
  }
  if (!props.hasData) {
    return props.emptyComponent;
  }
  return <Fragment>{props.dataComponents}</Fragment>;
}
