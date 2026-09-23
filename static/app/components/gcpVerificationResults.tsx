import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Stack} from '@sentry/scraps/layout';
import {StatusIndicator} from '@sentry/scraps/statusIndicator';
import {Text} from '@sentry/scraps/text';

import {t, tn} from 'sentry/locale';
import {
  getGcpErrorGroups,
  getServiceLabel,
  getStatusLabel,
  getStatusVariant,
  type GcpVerifyConnectionResponse,
} from 'sentry/utils/seer/gcpConnection';

export function GcpVerificationResults({result}: {result: GcpVerifyConnectionResponse}) {
  const groups = getGcpErrorGroups(result);
  const connected = result.projects.filter(
    project => project.connectionStatus === 'connected'
  );
  const unverified = result.projects.filter(
    project => project.connectionStatus === 'unverified'
  );
  const failedCount = result.projects.length - connected.length - unverified.length;
  const summary = [
    connected.length
      ? tn('%s project connected', '%s projects connected', connected.length)
      : null,
    failedCount
      ? tn('%s project needs attention', '%s projects need attention', failedCount)
      : null,
    unverified.length
      ? tn('%s project not verified', '%s projects not verified', unverified.length)
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Stack gap="lg" minWidth="0" width="100%" containerType="inline-size">
      <Stack gap="sm">
        <Flex gap="sm" align="center">
          <StatusIndicator
            variant={getStatusVariant(result.connectionStatus)}
            animationIterationCount={1}
          />
          <Text bold>
            {groups.length
              ? t('Connection needs attention')
              : getStatusLabel(result.connectionStatus)}
          </Text>
        </Flex>
        {summary && (
          <Text size="sm" variant="muted">
            {summary}
          </Text>
        )}
      </Stack>

      {groups.map(group => (
        <Stack
          key={group.key}
          as="section"
          aria-label={getStatusLabel(group.status)}
          gap="md"
          padding="lg"
          border="primary"
          radius="md"
          minWidth="0"
        >
          <Stack gap="sm">
            <Flex gap="sm" align="center">
              <StatusIndicator
                variant={getStatusVariant(group.status)}
                animationIterationCount={1}
              />
              <Text bold>{getStatusLabel(group.status)}</Text>
            </Flex>
            <Text density="comfortable" wrap="pre-line" wordBreak="break-word">
              {group.detail}
            </Text>
          </Stack>
          {group.projects.length > 0 && (
            <Stack
              as="ul"
              aria-label={t('Affected projects')}
              gap="sm"
              margin="0"
              padding="0"
            >
              {group.projects.map(project => (
                <Flex
                  as="li"
                  key={project.gcpProjectId}
                  direction={{xs: 'column', sm: 'row'}}
                  align={{xs: 'start', sm: 'baseline'}}
                  gap="xs md"
                  wrap="wrap"
                  minWidth="0"
                >
                  <Text bold size="sm" wordBreak="break-word">
                    {project.gcpProjectId}
                  </Text>
                  {project.services.length > 0 && (
                    <Text
                      size="sm"
                      variant="muted"
                      density="comfortable"
                      wordBreak="break-word"
                    >
                      {project.services.map(getServiceLabel).join(', ')}
                    </Text>
                  )}
                </Flex>
              ))}
            </Stack>
          )}
        </Stack>
      ))}

      {unverified.length > 0 && (
        <Stack gap="sm">
          <Text size="sm">
            {t('Run a connection check to verify access to these projects.')}
          </Text>
          <Stack
            as="ul"
            aria-label={t('Projects not verified')}
            gap="xs"
            margin="0"
            padding="0"
          >
            {unverified.map(project => (
              <Flex as="li" key={project.gcpProjectId} minWidth="0">
                <Text size="sm" wordBreak="break-word">
                  {project.gcpProjectId}
                </Text>
              </Flex>
            ))}
          </Stack>
        </Stack>
      )}

      {connected.length > 0 && (
        <Disclosure defaultExpanded={!groups.length} size="sm">
          <Disclosure.Title>{t('Connected projects')}</Disclosure.Title>
          <Disclosure.Content>
            <Stack
              as="ul"
              aria-label={t('Connected projects')}
              gap="xs"
              margin="0"
              padding="0"
            >
              {connected.map(project => (
                <Flex as="li" key={project.gcpProjectId} minWidth="0">
                  <Text size="sm" wordBreak="break-word">
                    {project.gcpProjectId}
                  </Text>
                </Flex>
              ))}
            </Stack>
          </Disclosure.Content>
        </Disclosure>
      )}
    </Stack>
  );
}
