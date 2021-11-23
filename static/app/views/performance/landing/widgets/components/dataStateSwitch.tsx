import {Fragment} from 'react';

export function DataStateSwitch(props: {
  isLoading: boolean;
  isErrored: boolean;
  hasData: boolean;

  loadingComponent?: JSX.Element;
  errorComponent: JSX.Element;
  dataComponents: JSX.Element[];
  emptyComponent: JSX.Element;
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
