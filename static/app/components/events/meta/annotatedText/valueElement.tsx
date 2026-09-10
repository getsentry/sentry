import {Fragment, isValidElement} from 'react';

import {t} from 'sentry/locale';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';

import {Redaction} from './redaction';

type Props = {
  value: React.ReactNode;
  meta?: Record<any, any>;
};

export function ValueElement({value, meta}: Props) {
  if (!!value && !isEmptyObject(meta)) {
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
