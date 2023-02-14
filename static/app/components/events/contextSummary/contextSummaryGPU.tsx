import styled from '@emotion/styled';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Meta} from 'sentry/types';
import {defined} from 'sentry/utils';

import ContextSummaryNoSummary from './contextSummaryNoSummary';
import Item from './item';
import {ContextItemProps} from './types';
import {generateIconName} from './utils';

type Data = {
  name: string;
  vendor_name?: string;
};

type VersionElement = {
  subject: string;
  value: string;
  meta?: Meta;
};

type Props = ContextItemProps<Data, 'gpu'>;

export function ContextSummaryGPU({data, meta}: Props) {
  if (Object.keys(data).length === 0) {
    return <ContextSummaryNoSummary title={t('Unknown GPU')} />;
  }

  const getVersionElement = (): VersionElement => {
    if (defined(data.vendor_name)) {
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
    <Item icon={generateIconName(data.vendor_name ? data.vendor_name : data.name)}>
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
