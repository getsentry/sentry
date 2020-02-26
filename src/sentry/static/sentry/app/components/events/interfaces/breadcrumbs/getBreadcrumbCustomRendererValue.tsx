import React from 'react';

import {Meta} from 'app/types';
import AnnotatedText from 'app/components/events/meta/annotatedText';

type Props = {
  value: React.ReactNode;
  meta?: Meta;
};

function getBreadcrumbCustomRendererValue({value, meta}: Props) {
  if (!meta) {
    return value;
  }

  return (
    <AnnotatedText
      value={value}
      chunks={meta.chunks}
      remarks={meta.rem}
      errors={meta.err}
    />
  );
}

export default getBreadcrumbCustomRendererValue;
