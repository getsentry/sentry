import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {getMeta} from 'app/components/events/meta/metaProxy';
import AnnotatedText from 'app/components/events/meta/annotatedText';
import space from 'app/styles/space';
import {ParagraphOverflow} from 'app/components/textOverflow';

import ContextSummaryNoSummary from './contextSummaryNoSummary';
import generateClassName from './generateClassName';

type Props = {
  data: Data;
  unknownTitle: string;
};

type Data = {
  name: string;
  version?: string;
};

const ContextSummaryGeneric = ({data, unknownTitle}: Props) => {
  if (Object.keys(data).length === 0) {
    return <ContextSummaryNoSummary title={unknownTitle} />;
  }

  const renderValue = (key: keyof Data) => {
    const meta = getMeta(data, key);
    return <AnnotatedText value={data[key]} meta={meta} />;
  };

  const className = generateClassName(data.name);

  return (
    <div className={`context-item ${className}`}>
      <span className="context-item-icon" />
      <h3>{renderValue('name')}</h3>
      <ParagraphOverflow>
        <Subject>{t('Version:')}</Subject>
        {!data.version ? t('Unknown') : renderValue('version')}
      </ParagraphOverflow>
    </div>
  );
};

export default ContextSummaryGeneric;

const Subject = styled('strong')`
  margin-right: ${space(0.5)};
`;
