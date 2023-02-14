import styled from '@emotion/styled';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

import ContextSummaryNoSummary from './contextSummaryNoSummary';
import Item from './item';
import {ContextItemProps} from './types';
import {generateIconName} from './utils';

type Data = {
  name: string;
  version?: string;
};

type Props = ContextItemProps<Data, any>;

export function ContextSummaryGeneric({
  data,
  unknownTitle,
  omitUnknownVersion = false,
  meta,
}: Props) {
  if (Object.keys(data).length === 0) {
    return <ContextSummaryNoSummary title={unknownTitle ?? t('Unknown')} />;
  }

  return (
    <Item icon={generateIconName(data.name, data.version)}>
      <h3>
        <AnnotatedText value={data.name} meta={meta.name?.['']} />
      </h3>
      {(data.version || !omitUnknownVersion) && (
        <TextOverflow isParagraph>
          <Subject>{t('Version:')}</Subject>
          {!defined(data.version) ? (
            t('Unknown')
          ) : (
            <AnnotatedText value={data.version} meta={meta.version?.['']} />
          )}
        </TextOverflow>
      )}
    </Item>
  );
}

const Subject = styled('strong')`
  margin-right: ${space(0.5)};
`;
