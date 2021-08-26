import * as React from 'react';

import {t} from 'app/locale';
import {Meta} from 'app/types';

import Redaction from './redaction';

type Props = {
  value: React.ReactNode;
  meta?: Meta;
};

// If you find yourself modifying this component to fix some tooltip bug,
// consider that `meta` is not properly passed into this component in the
// first place. It's much more likely that `withMeta` is buggy or improperly
// used than that this component has a bug.
const ValueElement = ({value, meta}: Props) => {
  if (value && meta) {
    return <Redaction>{value}</Redaction>;
  }

  if (meta?.err?.length) {
    return (
      <Redaction withoutBackground>
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

  if (React.isValidElement(value)) {
    return value;
  }

  return (
    <React.Fragment>
      {typeof value === 'object' || typeof value === 'boolean'
        ? JSON.stringify(value)
        : value}
    </React.Fragment>
  );
};

export default ValueElement;
