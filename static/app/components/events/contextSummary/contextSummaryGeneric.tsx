import styled from '@emotion/styled';

import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import ContextSummaryNoSummary from './contextSummaryNoSummary';
import generateClassName from './generateClassName';
import Item from './item';

type Props = {
  data: Data;
  unknownTitle: string;
  omitUnknownVersion?: boolean;
};

type Data = {
  name: string;
  version?: string;
};

const ContextSummaryGeneric = ({
  data,
  unknownTitle,
  omitUnknownVersion = false,
}: Props) => {
  if (Object.keys(data).length === 0) {
    return <ContextSummaryNoSummary title={unknownTitle} />;
  }

  const renderValue = (key: keyof Data) => {
    const meta = getMeta(data, key);
    return <AnnotatedText value={data[key]} meta={meta} />;
  };

  const className = generateClassName(data.name, data.version);

  return (
    <Item className={className} icon={<span className="context-item-icon" />}>
      <h3>{renderValue('name')}</h3>
      {(data.version || !omitUnknownVersion) && (
        <TextOverflow isParagraph>
          <Subject>{t('Version:')}</Subject>
          {!data.version ? t('Unknown') : renderValue('version')}
        </TextOverflow>
      )}
    </Item>
  );
};

export default ContextSummaryGeneric;

const Subject = styled('strong')`
  margin-right: ${space(0.5)};
`;
