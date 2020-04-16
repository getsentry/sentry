import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}>;

class ReleasesContainer extends React.Component<Props> {
  render() {
    const {children} = this.props;

    return children;
  }
}

export default ReleasesContainer;
