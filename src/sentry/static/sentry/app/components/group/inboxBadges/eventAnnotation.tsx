import React from 'react';
import {Query} from 'history';

import Tag from 'app/components/tag';

/**
 * Used in new inbox
 * Renders logger and other annotations for group
 */

type Props = {
  annotation?: string;
  htmlAnnotation?: string;
  to?: {
    pathname: string;
    query: Query;
  };
};

const EventAnnotation = ({annotation, htmlAnnotation, to}: Props) => (
  <Tag to={to}>
    {htmlAnnotation ? (
      <span dangerouslySetInnerHTML={{__html: htmlAnnotation}} />
    ) : (
      annotation
    )}
  </Tag>
);

export default EventAnnotation;
