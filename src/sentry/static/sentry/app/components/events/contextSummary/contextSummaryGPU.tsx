import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Meta} from 'app/types';
import {getMeta} from 'app/components/events/meta/metaProxy';
import AnnotatedText from 'app/components/events/meta/annotatedText';
import space from 'app/styles/space';
import {ParagraphOverflow} from 'app/components/textOverflow';

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

    return <AnnotatedText value={data.name} meta={meta} />;
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
      <ParagraphOverflow>
        <Subject>{versionElement.subject}</Subject>
        <AnnotatedText value={versionElement.value} meta={versionElement.meta} />
      </ParagraphOverflow>
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
