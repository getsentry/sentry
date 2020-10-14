import React from 'react';

import {t} from 'app/locale';
import {Meta} from 'app/types';

import Redaction from './redaction';

type Props = {
  value: React.ReactNode;
  meta?: Meta;
};

const ValueElement = ({value, meta}: Props) => {
  if (value && meta) {
    return <Redaction>{value}</Redaction>;
  }

  if (meta?.err?.length) {
    return (
      <Redaction>
        <i>{`<${t('invalid')}>`}</i>
      </Redaction>
    );
  }

  if (meta?.rem?.length) {
    return (
      <Redaction>
        <i>{`<${t('redacted')}>`}</i>
      </Redaction>
    );
  }

  if (!value) {
    return null;
  }

  if (React.isValidElement(value)) {
    return value;
  }

  return (
    <React.Fragment>
      {typeof value === 'object' ? JSON.stringify(value) : value}
    </React.Fragment>
  );
};

export default ValueElement;
