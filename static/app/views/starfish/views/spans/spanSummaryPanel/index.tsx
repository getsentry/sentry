import styled from '@emotion/styled';

import Detail from 'sentry/views/starfish/components/detailPanel';

type Span = {
  group_id: string;
  action?: string;
  description?: string;
  domain?: string;
};

type Props = {
  onClose: () => void;
  span?: Span;
};

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export function SpanSummaryPanel({span, onClose}: Props) {
  if (!span) {
    return null;
  }

  return (
    <Detail detailKey={span.group_id} onClose={onClose}>
      <h2>{t('Span Summary')}</h2>
      <SubHeader>{t('Description')}</SubHeader>
      <pre>{span?.description}</pre>
    </Detail>
  );
}

const SubHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  margin-bottom: ${space(1)};
`;
