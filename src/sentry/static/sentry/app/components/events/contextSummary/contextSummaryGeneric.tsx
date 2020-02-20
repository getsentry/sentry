import React from 'react';

import {t} from 'app/locale';
import {getMeta} from 'app/components/events/meta/metaProxy';
import AnnotatedText from 'app/components/events/meta/annotatedText';
import styled from '@emotion/styled';
import space from 'app/styles/space';

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
    if (!meta) {
      return data[key];
    }

    return (
      <AnnotatedText
        value={data[key]}
        chunks={meta.chunks}
        remarks={meta.rem}
        errors={meta.err}
      />
    );
  };

  const className = generateClassName(data.name);

  return (
    <div className={`context-item ${className}`}>
      <span className="context-item-icon" />
      <h3>{renderValue('name')}</h3>
      <p>
        <Subject>{t('Version:')}</Subject>
        {!data.version ? t('Unknown') : renderValue('version')}
      </p>
    </div>
  );
};

export default ContextSummaryGeneric;

const Subject = styled('strong')`
  margin-right: ${space(0.5)};
`;
