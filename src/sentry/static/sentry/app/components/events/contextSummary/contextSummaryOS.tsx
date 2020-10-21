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
  version?: string;
  kernel_version?: string;
};

type VersionElement = {
  subject: string;
  value: string;
  meta?: Meta;
};

const ContextSummaryOS = ({data}: Props) => {
  if (Object.keys(data).length === 0 || !data.name) {
    return <ContextSummaryNoSummary title={t('Unknown OS')} />;
  }

  const renderName = () => {
    const meta = getMeta(data, 'name');
    return <AnnotatedText value={data.name} meta={meta} />;
  };

  const getVersionElement = (): VersionElement => {
    if (data.version) {
      return {
        subject: t('Version:'),
        value: data.version,
        meta: getMeta(data, 'version'),
      };
    }

    if (data.kernel_version) {
      return {
        subject: t('Kernel:'),
        value: data.kernel_version,
        meta: getMeta(data, 'kernel_version'),
      };
    }

    return {
      subject: t('Version:'),
      value: t('Unknown'),
    };
  };

  const versionElement = getVersionElement();
  const className = generateClassName(data.name);

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

ContextSummaryOS.propTypes = {
  data: PropTypes.object.isRequired,
};

export default ContextSummaryOS;

const Subject = styled('strong')`
  margin-right: ${space(0.5)};
`;
