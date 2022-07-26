import styled from '@emotion/styled';

import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event, Meta} from 'sentry/types';
import {defined} from 'sentry/utils';

import ContextSummaryNoSummary from './contextSummaryNoSummary';
import generateClassName from './generateClassName';
import Item from './item';

type Props = {
  data: Data;
  meta: NonNullable<Event['_meta']>['os'] | NonNullable<Event['_meta']>['client_os'];
};

type Data = {
  name: string;
  kernel_version?: string;
  version?: string;
};

type VersionElement = {
  subject: string;
  value: string;
  meta?: Meta;
};

export function ContextSummaryOS({data, meta}: Props) {
  if (Object.keys(data).length === 0) {
    return <ContextSummaryNoSummary title={t('Unknown OS')} />;
  }

  const getVersionElement = (): VersionElement => {
    if (defined(data.version)) {
      return {
        subject: t('Version:'),
        value: data.version,
        meta: meta.version?.[''],
      };
    }

    if (defined(data.kernel_version)) {
      return {
        subject: t('Kernel:'),
        value: data.kernel_version,
        meta: meta.kernel_version?.[''],
      };
    }

    return {
      subject: t('Version:'),
      value: t('Unknown'),
    };
  };

  const versionElement = getVersionElement();

  return (
    <Item
      className={generateClassName(data.name)}
      icon={<span className="context-item-icon" />}
    >
      <h3>
        <AnnotatedText value={data.name} meta={meta.name?.['']} />
      </h3>
      <TextOverflow isParagraph data-test-id="context-sub-title">
        <Subject>{versionElement.subject}</Subject>
        <AnnotatedText value={versionElement.value} meta={versionElement.meta} />
      </TextOverflow>
    </Item>
  );
}

const Subject = styled('strong')`
  margin-right: ${space(0.5)};
`;
