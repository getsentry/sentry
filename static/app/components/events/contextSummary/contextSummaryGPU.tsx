import styled from '@emotion/styled';

import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Meta} from 'sentry/types';

import ContextSummaryNoSummary from './contextSummaryNoSummary';
import generateClassName from './generateClassName';
import Item from './item';

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
    <Item className={className} icon={<span className="context-item-icon" />}>
      <h3>{renderName()}</h3>
      <TextOverflow isParagraph>
        <Subject>{versionElement.subject}</Subject>
        <AnnotatedText value={versionElement.value} meta={versionElement.meta} />
      </TextOverflow>
    </Item>
  );
};

export default ContextSummaryGPU;

const Subject = styled('strong')`
  margin-right: ${space(0.5)};
`;
