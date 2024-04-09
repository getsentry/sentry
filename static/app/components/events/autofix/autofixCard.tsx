import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {AutofixSteps} from 'sentry/components/events/autofix/autofixSteps';
import {AutofixResult} from 'sentry/components/events/autofix/fixResult';
import type {AutofixData} from 'sentry/components/events/autofix/types';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export function AutofixCard({data, onRetry}: {data: AutofixData; onRetry: () => void}) {
  return (
    <AutofixPanel>
      <AutofixHeader>
        <Title>{t('Autofix')}</Title>
        <Button size="xs" onClick={onRetry}>
          Start Over
        </Button>
      </AutofixHeader>
      <AutofixSteps data={data} />
      <AutofixResult autofixData={data} onRetry={onRetry} />
    </AutofixPanel>
  );
}

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: bold;
`;

const AutofixPanel = styled(Panel)`
  margin-bottom: 0;
  overflow: hidden;
  background: ${p => p.theme.backgroundSecondary};
  padding: ${space(2)} ${space(3)} ${space(3)} ${space(3)};
`;

const AutofixHeader = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  margin-bottom: ${space(2)};
`;
