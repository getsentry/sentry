import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Meta} from 'app/types';
import {getMeta} from 'app/components/events/meta/metaProxy';
import AnnotatedText from 'app/components/events/meta/annotatedText';
import DeviceName from 'app/components/deviceName';
import space from 'app/styles/space';
import {ParagraphOverflow} from 'app/components/textOverflow';

import generateClassName from './generateClassName';
import ContextSummaryNoSummary from './contextSummaryNoSummary';

type Props = {
  data: Data;
};

type Data = {
  model?: string;
  arch?: string;
  model_id?: string;
};

type SubTitle = {
  subject: string;
  value: string;
  meta?: Meta;
};

const ContextSummaryDevice = ({data}: Props) => {
  if (Object.keys(data).length === 0) {
    return <ContextSummaryNoSummary title={t('Unknown Device')} />;
  }

  const renderName = () => {
    if (!data.model) {
      return t('Unknown Device');
    }

    const meta = getMeta(data, 'model');

    return (
      <DeviceName value={data.model}>
        {deviceName => {
          return <AnnotatedText value={deviceName} meta={meta} />;
        }}
      </DeviceName>
    );
  };

  const getSubTitle = (): SubTitle | null => {
    if (data.arch) {
      return {
        subject: t('Arch:'),
        value: data.arch,
        meta: getMeta(data, 'arch'),
      };
    }

    if (data.model_id) {
      return {
        subject: t('Model:'),
        value: data.model_id,
        meta: getMeta(data, 'model_id'),
      };
    }

    return null;
  };

  // TODO(dcramer): we need a better way to parse it
  const className = generateClassName(data.model);
  const subTitle = getSubTitle();

  return (
    <div className={`context-item ${className}`}>
      <span className="context-item-icon" />
      <h3>{renderName()}</h3>
      {subTitle && (
        <ParagraphOverflow>
          <Subject>{subTitle.subject}</Subject>
          <AnnotatedText value={subTitle.value} meta={subTitle.meta} />
        </ParagraphOverflow>
      )}
    </div>
  );
};

ContextSummaryDevice.propTypes = {
  data: PropTypes.object.isRequired,
};

export default ContextSummaryDevice;

const Subject = styled('strong')`
  margin-right: ${space(0.5)};
`;
