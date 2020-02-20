import React from 'react';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import {Meta} from 'app/types';
import {getMeta} from 'app/components/events/meta/metaProxy';
import AnnotatedText from 'app/components/events/meta/annotatedText';
import styled from '@emotion/styled';
import space from 'app/styles/space';

import ContextSummaryNoSummary from './contextSummaryNoSummary';
import generateClassName from './generateClassName';

type Props = {
  data: Data;
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

const ContextSummaryGPU = ({data}: Props) => {
  if (Object.keys(data).length === 0 || !data.name) {
    return <ContextSummaryNoSummary title={t('Unknown GPU')} />;
  }

  const renderName = () => {
    const meta = getMeta(data, 'name');
    if (!meta) {
      return data.name;
    }

    return (
      <AnnotatedText
        value={data.name}
        chunks={meta.chunks}
        remarks={meta.rem}
        errors={meta.err}
      />
    );
  };

  let className = generateClassName(data.name);

  const getVersionElement = (): VersionElement => {
    if (data.vendor_name) {
      className = generateClassName(data.vendor_name);
      return {
        subject: t('Vendor:'),
        value: data.vendor_name,
        meta: getMeta(data, 'vendor_name'),
      };
    }

    return {
      subject: t('Vendor:'),
      value: t('Unknown'),
    };
  };

  const versionElement = getVersionElement();

  return (
    <div className={`context-item ${className}`}>
      <span className="context-item-icon" />
      <h3>{renderName()}</h3>
      <p>
        <Subject>{versionElement.subject}</Subject>
        {versionElement.meta ? (
          <AnnotatedText
            value={versionElement.value}
            chunks={versionElement.meta.chunks}
            remarks={versionElement.meta.rem}
            errors={versionElement.meta.err}
          />
        ) : (
          versionElement.value
        )}
      </p>
    </div>
  );
};

ContextSummaryGPU.propTypes = {
  data: PropTypes.object.isRequired,
};

export default ContextSummaryGPU;

const Subject = styled('strong')`
  margin-right: ${space(0.5)};
`;
