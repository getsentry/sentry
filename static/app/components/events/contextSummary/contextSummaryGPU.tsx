import styled from '@emotion/styled';

import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event, Meta} from 'sentry/types';

import ContextSummaryNoSummary from './contextSummaryNoSummary';
import generateClassName from './generateClassName';
import Item from './item';

type Props = {
  data: Data;
  meta: NonNullable<Event['_meta']>['gpu'];
};

type Data = {
  name: string;
  vendor_name?: string;
};

type VersionElement = {
  subject: string;
  value: string;
  meta?: Meta;
};

export function ContextSummaryGPU({data, meta}: Props) {
  if (Object.keys(data).length === 0 || !data.name) {
    return <ContextSummaryNoSummary title={t('Unknown GPU')} />;
  }

  const getVersionElement = (): VersionElement => {
    if (data.vendor_name) {
      return {
        subject: t('Vendor:'),
        value: data.vendor_name,
        meta: meta.vendor_name?.[''],
      };
    }

    return {
      subject: t('Vendor:'),
      value: t('Unknown'),
    };
  };

  const versionElement = getVersionElement();

  return (
    <Item
      className={generateClassName(data.vendor_name ? data.vendor_name : data.name)}
      icon={<span className="context-item-icon" />}
    >
      <h3>
        <AnnotatedText value={data.name} meta={meta.name?.['']} />
      </h3>
      <TextOverflow isParagraph>
        <Subject>{versionElement.subject}</Subject>
        <AnnotatedText value={versionElement.value} meta={versionElement.meta} />
      </TextOverflow>
    </Item>
  );
}

const Subject = styled('strong')`
  margin-right: ${space(0.5)};
`;
