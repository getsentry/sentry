import {useCallback, useEffect, useRef, useState} from 'react';
import {focusManager} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {IconOpen} from 'sentry/icons/iconOpen';
import {t} from 'sentry/locale';

type RepositoryPermissionCheckPhase = 'ready' | 'checking' | 'retry_available';
type PermissionFocusCheckPhase = 'idle' | 'awaiting_hidden' | 'awaiting_visible';

interface RepositoryWritePermissionButtonProps {
  checkTargetWriteAccess: () => Promise<boolean>;
  label: string;
  permissionsUrl: string;
  providerName: string;
  disabled?: boolean;
}

export function RepositoryWritePermissionButton({
  checkTargetWriteAccess,
  disabled,
  label,
  permissionsUrl,
  providerName,
}: RepositoryWritePermissionButtonProps) {
  const [phase, setPhase] = useState<RepositoryPermissionCheckPhase>('ready');
  const focusCheckPhase = useRef<PermissionFocusCheckPhase>('idle');

  const runCheck = useCallback(async () => {
    focusCheckPhase.current = 'idle';
    setPhase('checking');

    const hasWriteAccess = await checkTargetWriteAccess();
    setPhase(hasWriteAccess ? 'ready' : 'retry_available');
  }, [checkTargetWriteAccess]);

  useEffect(() => {
    return focusManager.subscribe(isFocused => {
      if (!isFocused && focusCheckPhase.current === 'awaiting_hidden') {
        focusCheckPhase.current = 'awaiting_visible';
        return;
      }

      if (isFocused && focusCheckPhase.current === 'awaiting_visible') {
        void runCheck();
      }
    });
  }, [runCheck]);

  const checkAfterReturning = () => {
    focusCheckPhase.current = 'awaiting_hidden';
  };

  switch (phase) {
    case 'checking':
      return (
        <Button variant="primary" busy disabled>
          {t('Checking %s permissions', providerName)}
        </Button>
      );
    case 'retry_available': {
      const viewPermissionsLabel = t('View %s permissions', providerName);

      return (
        <Flex gap="md" align="center">
          <Button
            variant="primary"
            tooltipProps={{
              title: t(
                "We couldn't confirm write access. Check your %s permissions, then try again.",
                providerName
              ),
            }}
            onClick={() => void runCheck()}
          >
            {t('Check access again')}
          </Button>
          <ExternalLink href={permissionsUrl} onClick={checkAfterReturning}>
            <Flex as="span" display="inline-flex" gap="xs" align="center">
              <Text as="span" variant="inherit">
                {viewPermissionsLabel}
              </Text>
              <IconOpen size="xs" />
            </Flex>
          </ExternalLink>
        </Flex>
      );
    }
    case 'ready':
      return (
        <LinkButton
          external
          variant="primary"
          disabled={disabled}
          href={permissionsUrl}
          icon={<IconOpen />}
          tooltipProps={{
            title: t(
              'You need to grant write permissions for your %s integration',
              providerName
            ),
          }}
          onClick={checkAfterReturning}
        >
          {label}
        </LinkButton>
      );
  }
}
