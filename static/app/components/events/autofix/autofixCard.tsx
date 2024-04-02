import styled from '@emotion/styled';

import {AutofixSteps} from 'sentry/components/events/autofix/autofixSteps';
import {AutofixResult} from 'sentry/components/events/autofix/fixResult';
import type {AutofixData} from 'sentry/components/events/autofix/types';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type AutofixCardProps = {
  data: AutofixData;
  groupId: string;
  onRetry: () => void;
};

export function AutofixCard({data, onRetry, groupId}: AutofixCardProps) {
  const hasSteps = data.steps && data.steps.length > 0;

  const isDone = data.status === 'COMPLETED';

  return (
    <AutofixPanel>
      <Title>{t('Autofix')}</Title>
      {hasSteps && !isDone ? (
        <AutofixSteps data={data} groupId={groupId} runId={data.run_id} />
      ) : null}
      {isDone && <AutofixResult autofixData={data} onRetry={onRetry} />}
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
