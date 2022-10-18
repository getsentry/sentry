import {Fragment, isValidElement} from 'react';

import {t} from 'sentry/locale';

import {Redaction} from './redaction';

type Props = {
  value: React.ReactNode;
  meta?: Record<any, any>;
};

// If you find yourself modifying this component to fix some tooltip bug,
// consider that `meta` is not properly passed into this component in the
// first place. It's much more likely that `withMeta` is buggy or improperly
// used than that this component has a bug.
export function ValueElement({value, meta}: Props) {
  if (!!value && meta) {
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

  if (isValidElement(value)) {
    return value;
  }

  return (
    <Fragment>
      {typeof value === 'object' || typeof value === 'boolean'
        ? JSON.stringify(value)
        : value}
    </Fragment>
  );
}
