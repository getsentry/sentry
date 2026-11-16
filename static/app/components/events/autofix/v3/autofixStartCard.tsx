import {useState} from 'react';
import styled from '@emotion/styled';
import {IconBug} from '@sentry/icons/bug';

import seerConfigConnectImg from 'sentry-images/spot/seer-config-connect-2.svg';

import {Button} from '@sentry/scraps/button';
import type {CSS} from '@sentry/scraps/cssTypes';
import {Image} from '@sentry/scraps/image';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {useAutofixCreditCheck} from 'sentry/components/events/autofix/autofixCredits';
import type {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {SeerOutOfCreditsCta} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsCta';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';

import {useOpenSingleRunChat} from './useToggleSingleRunChat';

interface AutofixStartCardProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
  /**
   * Called after a run has been successfully started. The sidebar uses this to
   * open the Seer drawer; surfaces that already render the autofix in place
   * (e.g. the issue preview drawer) can omit it.
   */
  onStarted?: () => void;
  referrer?: string;
  /**
   * Swaps the "Have Seer..." explainer for the muted out-of-credits notice,
   * above the disabled start button. The issue sidebar sets this; the Seer
   * drawer and Autofix tab show their own alert at the top of their content
   * instead.
   */
  showOutOfCreditsNotice?: boolean;
}

export function AutofixStartCard({
  autofix,
  group,
  onStarted,
  referrer,
  showOutOfCreditsNotice,
}: AutofixStartCardProps) {
  // extract startStep first here so we can depend on it directly as `autofix` itself is unstable.
  const startStep = autofix.startStep;

  const creditCheck = useAutofixCreditCheck('root_cause');

  const [startingRun, setStartingRun] = useState(false);
  const isStarting = startingRun || autofix.isWaitingForRun;
  const openSingleRunChat = useOpenSingleRunChat();
  const handleStartRootCause = async () => {
    setStartingRun(true);
    const run = await startStep('root_cause').catch(() => null);
    setStartingRun(false);
    if (!run) {
      return;
    }
    if (run.isSingleRun) {
      openSingleRunChat(run.runId);
    } else {
      onStarted?.();
    }
  };

  return (
    <Stack gap="md">
      {/* The Billing Gates design gives the sidebar one card: the notice takes the explainer's place. */}
      {showOutOfCreditsNotice && !creditCheck.hasEnoughCredits ? (
        <SeerOutOfCreditsCta
          reason="autofix-start"
          denialReason={creditCheck.denialReason}
          variant="muted"
        />
      ) : (
        <AutofixStartCardContent />
      )}
      <Button
        size="md"
        icon={<IconBug />}
        aria-label={t('Start Analysis')}
        variant="primary"
        onClick={handleStartRootCause}
        analyticsEventKey="autofix.start_fix_clicked"
        analyticsEventName="Autofix: Start Fix Clicked"
        analyticsParams={{group_id: group.id, mode: 'explorer', referrer}}
        busy={isStarting}
        // Held disabled until this mount's credit check answers, so it is never
        // clickable before the answer arrives, even with an earlier one cached.
        disabled={
          isStarting || !creditCheck.hasCheckedSinceMount || !creditCheck.hasEnoughCredits
        }
      >
        {t('Start Analysis')}
      </Button>
    </Stack>
  );
}

function AutofixStartCardContent() {
  return (
    <Flex
      border="muted"
      radius="md"
      padding="lg"
      gap="lg"
      align="center"
      justify="between"
    >
      <Container>
        <Text>{t('Have Seer...')}</Text>
        <Container as="ol" margin="0">
          <li>{t('Determine the root cause of your issue')}</li>
          <li>{t('Outline a plan')}</li>
          <li>{t('Create a code fix')}</li>
        </Container>
      </Container>
      <ImageContainer
        justify="end"
        align="center"
        aspectRatio="9 / 16"
        height={{zero: '78px', '4xl': '98px'}}
      >
        <Image src={seerConfigConnectImg} alt="" width="auto" height="100%" />
      </ImageContainer>
    </Flex>
  );
}

const ImageContainer = styled(Flex)<{
  aspectRatio?: CSS['aspectRatio'];
}>`
  ${p => p.aspectRatio && `aspect-ratio: ${p.aspectRatio}`};
`;
