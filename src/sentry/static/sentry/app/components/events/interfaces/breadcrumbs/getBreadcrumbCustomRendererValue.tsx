import React from 'react';

import {Meta} from 'app/types';
import AnnotatedText from 'app/components/events/meta/annotatedText';

type Props = {
  value: React.ReactNode;
  meta?: Meta;
};

function getBreadcrumbCustomRendererValue({value, meta}: Props) {
  return <AnnotatedText value={value} meta={meta} />;
}

export default getBreadcrumbCustomRendererValue;
