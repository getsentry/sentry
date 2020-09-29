import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {Organization} from 'app/types';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  children: React.ReactNode;
};

function ReleasesContainer(props: Props) {
  return props.children;
}

export default ReleasesContainer;
