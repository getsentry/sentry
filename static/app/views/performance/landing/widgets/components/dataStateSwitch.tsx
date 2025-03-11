import {Fragment} from 'react';

export function DataStateSwitch(props: {
  dataComponents: React.JSX.Element[];
  emptyComponent: React.JSX.Element;
  errorComponent: React.JSX.Element;

  hasData: boolean;
  isErrored: boolean;
  isLoading: boolean;
  loadingComponent?: React.JSX.Element;
}): React.JSX.Element {
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
