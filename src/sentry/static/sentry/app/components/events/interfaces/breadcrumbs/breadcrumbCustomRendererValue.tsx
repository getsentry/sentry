import React from 'react';

import {Meta} from 'app/types';
import AnnotatedText from 'app/components/events/meta/annotatedText';

type Props = {
  meta?: Meta;
  value: React.ReactElement | string;
};

const BreadcrumbCustomRendererValue = ({value, meta}: Props) => {
  if (!meta) {
    return typeof value === 'string' ? <React.Fragment>{value}</React.Fragment> : value;
  }

  return (
    <AnnotatedText
      value={value}
      chunks={meta.chunks}
      remarks={meta.rem}
      errors={meta.err}
    />
  );
};

export default BreadcrumbCustomRendererValue;
