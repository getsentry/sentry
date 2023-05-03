import React from 'react';
import {RouteComponentProps} from 'react-router';
import {Location} from 'history';

type Props = {
  location: Location;
} & RouteComponentProps<{groupId: string}, {}>;

export default function Spans({}: Props) {
  return <div>Spans!</div>;
}
