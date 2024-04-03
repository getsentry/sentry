import styled from '@emotion/styled';

import {AutofixDoneLogs} from 'sentry/components/events/autofix/autofixDoneLogs';
import {AutofixSteps} from 'sentry/components/events/autofix/autofixSteps';
import {AutofixResult} from 'sentry/components/events/autofix/fixResult';
import type {AutofixData} from 'sentry/components/events/autofix/types';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export function AutofixCard({data, onRetry}: {data: AutofixData; onRetry: () => void}) {
  const hasSteps = data.steps && data.steps.length > 0;

  const isDone = data.status !== 'PROCESSING';

  return (
    <AutofixPanel>
      <Title>{t('Autofix')}</Title>
      <AutofixResult autofixData={data} onRetry={onRetry} />
      {hasSteps && !isDone ? <AutofixSteps data={data} /> : null}
      {hasSteps && isDone ? <AutofixDoneLogs data={data} /> : null}
    </AutofixPanel>
  );
}

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: bold;
  margin-bottom: ${space(2)};
`;

const AutofixPanel = styled(Panel)`
  margin-bottom: 0;
  overflow: hidden;
  background: ${p => p.theme.backgroundSecondary};
  padding: ${space(2)} ${space(3)} ${space(3)} ${space(3)};
`;
