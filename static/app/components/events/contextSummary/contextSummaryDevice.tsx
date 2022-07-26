import styled from '@emotion/styled';

import {DeviceName} from 'sentry/components/deviceName';
import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event, Meta} from 'sentry/types';

import ContextSummaryNoSummary from './contextSummaryNoSummary';
import generateClassName from './generateClassName';
import Item from './item';

type Props = {
  data: Data;
  meta: NonNullable<Event['_meta']>['device'];
};

type Data = {
  arch?: string;
  model?: string;
  model_id?: string;
};

type SubTitle = {
  subject: string;
  value: string;
  meta?: Meta;
};

export function ContextSummaryDevice({data, meta}: Props) {
  if (Object.keys(data).length === 0) {
    return <ContextSummaryNoSummary title={t('Unknown Device')} />;
  }

  const renderName = () => {
    if (!data.model) {
      return t('Unknown Device');
    }

    return (
      <DeviceName value={data.model}>
        {deviceName => {
          return <AnnotatedText value={deviceName} meta={meta.model?.['']} />;
        }}
      </DeviceName>
    );
  };

  const getSubTitle = (): SubTitle | null => {
    if (data.arch) {
      return {
        subject: t('Arch:'),
        value: data.arch,
        meta: meta.arch?.[''],
      };
    }

    if (data.model_id) {
      return {
        subject: t('Model:'),
        value: data.model_id,
        meta: meta.model_id?.[''],
      };
    }

    return null;
  };

  // TODO(dcramer): we need a better way to parse it
  const className = generateClassName(data.model);
  const subTitle = getSubTitle();

  return (
    <Item className={className} icon={<span className="context-item-icon" />}>
      <h3>{renderName()}</h3>
      {subTitle && (
        <TextOverflow isParagraph data-test-id="context-sub-title">
          <Subject>{subTitle.subject}</Subject>
          <AnnotatedText value={subTitle.value} meta={subTitle.meta} />
        </TextOverflow>
      )}
    </Item>
  );
}

const Subject = styled('strong')`
  margin-right: ${space(0.5)};
`;
