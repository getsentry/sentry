import styled from '@emotion/styled';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {
  getChildMetaContainer,
  getMeta,
} from 'sentry/components/events/meta/metaContainer';
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
  name: string | boolean;
  kernel_version?: string;
  version?: string | boolean;
};

type VersionElement = {
  subject: string;
  value: string;
  meta?: Partial<Meta>;
};

type Props = ContextItemProps<Data>;

export function ContextSummaryOS({data, meta}: Props) {
  if (Object.keys(data).length === 0) {
    return <ContextSummaryNoSummary title={t('Unknown OS')} />;
  }

  const getVersionElement = (): VersionElement => {
    if (defined(data.version) && typeof data.version === 'string') {
      return {
        subject: t('Version:'),
        value: data.version,
        meta: getMeta(getChildMetaContainer(meta, 'version')),
      };
    }

    if (defined(data.kernel_version)) {
      return {
        subject: t('Kernel:'),
        value: data.kernel_version,
        meta: getMeta(getChildMetaContainer(meta, 'kernel_version')),
      };
    }

    return {
      subject: t('Version:'),
      value: t('Unknown'),
    };
  };

  const versionElement = getVersionElement();

  return (
    <Item icon={generateIconName(data.name)}>
      <h3>
        <AnnotatedText
          value={data.name}
          meta={getMeta(getChildMetaContainer(meta, 'name'))}
        />
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
