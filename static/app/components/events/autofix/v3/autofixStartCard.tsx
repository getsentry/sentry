import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {IconBug} from '@sentry/icons/bug';

import seerConfigConnectImg from 'sentry-images/spot/seer-config-connect-2.svg';

import {Button} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Input} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {useAutofixCreditCheck} from 'sentry/components/events/autofix/autofixCredits';
import {AUTOFIX_USER_CONTEXT_MAX_LENGTH} from 'sentry/components/events/autofix/types';
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
  const [showContext, setShowContext] = useState(false);
  const [userContext, setUserContext] = useState('');
  const isStarting = startingRun || autofix.isWaitingForRun;
  const showNotice = showOutOfCreditsNotice && !creditCheck.hasEnoughCredits;
  const isStartDisabled =
    isStarting || !creditCheck.hasCheckedSinceMount || !creditCheck.hasEnoughCredits;
  const openSingleRunChat = useOpenSingleRunChat();
  const handleStartRootCause = async () => {
    setStartingRun(true);
    const run = await startStep('root_cause', {
      userContext: userContext.trim(),
    }).catch(() => null);
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
      {/* The Billing Gates design gives the sidebar one card: the notice takes the pitch's place. */}
      {showNotice ? (
        <SeerOutOfCreditsCta
          reason="autofix-start"
          denialReason={creditCheck.denialReason}
          variant="muted"
        />
      ) : null}
      <Flex border="muted" radius="md" padding="lg" gap="lg" align="center" wrap="wrap">
        {showNotice ? null : (
          <Fragment>
            <ImageContainer align="center" height="40px">
              <Image src={seerConfigConnectImg} alt="" width="auto" height="100%" />
            </ImageContainer>
            <Stack gap="xs" flex="1" minWidth="200px">
              <Text bold>{t('Let Seer find the root cause and fix it')}</Text>
              <Text variant="muted">
                {t(
                  'It investigates this issue, writes a code fix, and can open a pull request for you to review.'
                )}
              </Text>
            </Stack>
          </Fragment>
        )}
        <Flex gap="md" wrap="wrap">
          {showContext ? null : (
            <Button size="md" onClick={() => setShowContext(true)}>
              {t('Add context')}
            </Button>
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
            disabled={isStartDisabled}
          >
            {t('Start Analysis')}
          </Button>
        </Flex>
        {showContext ? (
          <ContextInput
            autoFocus
            aria-label={t('Context for Seer')}
            placeholder={t('Anything Seer should know? Optional')}
            maxLength={AUTOFIX_USER_CONTEXT_MAX_LENGTH}
            value={userContext}
            onChange={event => setUserContext(event.target.value)}
            onKeyDown={event => {
              if (
                event.key === 'Enter' &&
                !event.nativeEvent.isComposing &&
                !isStartDisabled
              ) {
                handleStartRootCause();
              }
            }}
          />
        ) : null}
      </Flex>
    </Stack>
  );
}

const ImageContainer = styled(Flex)`
  flex: none;
`;

const ContextInput = styled(Input)`
  flex-basis: 100%;
`;
