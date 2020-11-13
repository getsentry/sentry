import React from 'react';
import {Link} from 'react-router';
import {Query} from 'history';

import Tag from 'app/components/tag';

/**
 * Used in new inbox
 * Renders logger and other annotations for group
 */

type Props = {
  annotation: string;
  to?: {
    pathname: string;
    query: Query;
  };
};

const EventAnnotation = ({annotation, to}: Props) =>
  to ? (
    <Link to={to}>
      <Tag>{annotation}</Tag>
    </Link>
  ) : (
    <Tag>{annotation}</Tag>
  );

export default EventAnnotation;
