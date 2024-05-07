import {useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {AutofixSteps} from 'sentry/components/events/autofix/autofixSteps';
import type {AutofixData} from 'sentry/components/events/autofix/types';
import useFeedbackWidget from 'sentry/components/feedback/widget/useFeedbackWidget';
import Panel from 'sentry/components/panels/panel';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type AutofixCardProps = {
  data: AutofixData;
  groupId: string;
  onRetry: () => void;
};

function AutofixFeedback() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const feedback = useFeedbackWidget({
    buttonRef,
    messagePlaceholder: t('How can we make Autofix better for you?'),
  });

  if (!feedback) {
    return null;
  }

  return (
    <Button ref={buttonRef} size="xs" icon={<IconMegaphone />}>
      {t('Give Feedback')}
    </Button>
  );
}

export function AutofixCard({data, onRetry, groupId}: AutofixCardProps) {
  return (
    <AutofixPanel>
      <AutofixHeader>
        <Title>{t('Autofix')}</Title>
        <ButtonBar gap={1}>
          <AutofixFeedback />
          <Button size="xs" onClick={onRetry}>
            {t('Start Over')}
          </Button>
        </ButtonBar>
      </AutofixHeader>
      <AutofixSteps data={data} runId={data.run_id} groupId={groupId} onRetry={onRetry} />
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
