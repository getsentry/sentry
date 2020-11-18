import React from 'react';
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

const EventAnnotation = ({annotation, to}: Props) => <Tag to={to}>{annotation}</Tag>;

export default EventAnnotation;
