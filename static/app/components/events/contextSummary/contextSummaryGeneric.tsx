import styled from '@emotion/styled';

import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event} from 'sentry/types';
import {defined} from 'sentry/utils';

import ContextSummaryNoSummary from './contextSummaryNoSummary';
import generateClassName from './generateClassName';
import Item from './item';

type Props = {
  data: Data;
  meta: NonNullable<Event['_meta']>[keyof Event['_meta']];
  unknownTitle: string;
  omitUnknownVersion?: boolean;
};

type Data = {
  name: string;
  version?: string;
};

export function ContextSummaryGeneric({
  data,
  unknownTitle,
  omitUnknownVersion = false,
  meta,
}: Props) {
  if (Object.keys(data).length === 0) {
    return <ContextSummaryNoSummary title={unknownTitle} />;
  }

  return (
    <Item
      className={generateClassName(data.name, data.version)}
      icon={<span className="context-item-icon" />}
    >
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
