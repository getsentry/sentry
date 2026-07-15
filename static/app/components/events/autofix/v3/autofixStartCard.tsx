import {type CSSProperties, useState} from 'react';
import styled from '@emotion/styled';

import seerConfigConnectImg from 'sentry-images/spot/seer-config-connect-2.svg';

import {Button} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconBug} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';

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
}

export function AutofixStartCard({
  autofix,
  group,
  onStarted,
  referrer,
}: AutofixStartCardProps) {
  // extract startStep first here so we can depend on it directly as `autofix` itself is unstable.
  const startStep = autofix.startStep;

  const [startingRun, setStartingRun] = useState(false);
  const handleStartRootCause = async () => {
    setStartingRun(true);
    try {
      await startStep('root_cause');
    } catch {
      return;
    } finally {
      setStartingRun(false);
    }
    onStarted?.();
  };

  return (
    <Stack gap="md">
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
          height={{'screen:2xs': '78px', 'screen:lg': '98px'}}
        >
          <Image src={seerConfigConnectImg} alt="" width="auto" height="100%" />
        </ImageContainer>
      </Flex>
      <Button
        size="md"
        icon={startingRun ? <LoadingIndicator size={16} /> : <IconBug />}
        aria-label={t('Start Analysis')}
        variant="primary"
        onClick={handleStartRootCause}
        analyticsEventKey="autofix.start_fix_clicked"
        analyticsEventName="Autofix: Start Fix Clicked"
        analyticsParams={{group_id: group.id, mode: 'explorer', referrer}}
        disabled={startingRun}
      >
        {t('Start Analysis')}
      </Button>
    </Stack>
  );
}

const ImageContainer = styled(Flex)<{
  aspectRatio?: CSSProperties['aspectRatio'];
}>`
  ${p => p.aspectRatio && `aspect-ratio: ${p.aspectRatio}`};
`;
