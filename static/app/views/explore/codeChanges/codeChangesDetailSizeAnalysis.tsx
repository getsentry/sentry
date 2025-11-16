import styled from '@emotion/styled';

import {Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';

export function SizeAnalysisView() {
  return (
    <PlaceholderContainer>
      <Text size="lg">{t('Size Analysis content will go here')}</Text>
    </PlaceholderContainer>
  );
}

const PlaceholderContainer = styled('div')`
  padding: ${p => p.theme.space['3xl']};
  text-align: center;
  color: ${p => p.theme.subText};
`;
