import {Fragment, type ReactNode} from 'react';

import {Button} from '@sentry/scraps/button';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Container, Flex, Stack} from 'sentry/components/core/layout';
import {Separator} from 'sentry/components/core/separator';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {QuietZoneQRCode} from 'sentry/components/quietZoneQRCode';
import {IconLink} from 'sentry/icons';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useApiQuery} from 'sentry/utils/queryClient';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';
import type {InstallDetailsApiResponse} from 'sentry/views/preprod/types/installDetailsTypes';

interface InstallDetailsContentProps {
  artifactId: string;
  projectId: string;
  onClose?: () => void;
  size?: 'sm' | 'lg';
}

export function InstallDetailsContent({
  projectId,
  artifactId,
  onClose,
  size = 'sm',
}: InstallDetailsContentProps) {
  const organization = useOrganization();
  const {copy} = useCopyToClipboard();
  const isLarge = size === 'lg';
  const qrSize = isLarge ? 200 : 120;
  const outerGap = isLarge ? 'lg' : 'xl';
  const wrapperStyle = isLarge ? {padding: space(4)} : undefined;

  const {
    data: installDetails,
    isPending,
    isError,
    error,
    refetch,
  } = useApiQuery<InstallDetailsApiResponse>(
    [
      `/projects/${organization.slug}/${projectId}/preprodartifacts/${artifactId}/install-details/`,
    ],
    {
      staleTime: 0,
    }
  );

  const header = (
    <Flex justify="center" align="center" width="100%" position="relative">
      <Heading as={isLarge ? 'h3' : 'h2'}>{t('Install App')}</Heading>
      {onClose && (
        <Container
          position="absolute"
          style={{top: '50%', right: 0, transform: 'translateY(-50%)'}}
        >
          <Button
            onClick={onClose}
            priority="transparent"
            icon={<IconClose />}
            size="sm"
            aria-label={t('Close')}
          />
        </Container>
      )}
    </Flex>
  );

  if (isPending) {
    return (
      <Flex direction="column" align="center" gap={outerGap} style={wrapperStyle}>
        {header}
        <LoadingIndicator />
        <Text>{t('Loading install details...')}</Text>
      </Flex>
    );
  }

  if (isError || !installDetails) {
    return (
      <Flex direction="column" align="center" gap={outerGap} style={wrapperStyle}>
        {header}
        <Text>{t('Error: %s', error?.message || 'Failed to fetch install details')}</Text>
        <Button onClick={() => refetch()}>{t('Retry')}</Button>
      </Flex>
    );
  }

  if (installDetails.codesigning_type === 'appstore') {
    return (
      <Flex direction="column" align="center" gap={outerGap} style={wrapperStyle}>
        {header}
        <CodeSignatureInfo>
          <Text>{t('This app cannot be installed')}</Text>
          <br />
          <Text size="sm" variant="muted">
            {tct(
              'App was signed for the App Store using the [profileName] profile and cannot be installed directly. Re-upload with an enterprise, ad-hoc, or development profile to install this app.',
              {
                profileName: <strong>{installDetails.profile_name}</strong>,
              }
            )}
          </Text>
        </CodeSignatureInfo>
      </Flex>
    );
  }

  if (!installDetails.install_url) {
    if (!installDetails.is_code_signature_valid) {
      let errors = null;
      if (
        installDetails.code_signature_errors &&
        installDetails.code_signature_errors.length > 0
      ) {
        errors = (
          <CodeSignatureInfo>
            <Stack gap="sm">
              {installDetails.code_signature_errors.map((e, index) => (
                <Text key={index}>{e}</Text>
              ))}
            </Stack>
          </CodeSignatureInfo>
        );
      }
      return (
        <Flex direction="column" align="center" gap={outerGap} style={wrapperStyle}>
          {header}
          <Text>{'Code signature is invalid'}</Text>
          {errors}
        </Flex>
      );
    }
    return (
      <Flex direction="column" align="center" gap={outerGap} style={wrapperStyle}>
        {header}
        <Text>{t('No install download link available')}</Text>
      </Flex>
    );
  }

  const details = installDetails.is_code_signature_valid !== undefined && (
    <CodeSignatureInfo>
      {installDetails.profile_name && (
        <Text size="sm" variant="muted" style={{marginBottom: space(0.5)}}>
          {t('Profile: %s', installDetails.profile_name)}
        </Text>
      )}
      {installDetails.profile_name && installDetails.codesigning_type && <br />}
      {installDetails.codesigning_type && (
        <Text size="sm" variant="muted" style={{marginBottom: space(0.5)}}>
          {t('Type: %s', installDetails.codesigning_type)}
        </Text>
      )}
    </CodeSignatureInfo>
  );

  return (
    <Fragment>
      <Flex direction="column" align="center" gap={outerGap} style={wrapperStyle}>
        {header}

        <Fragment>
          <Stack align="center" gap="md">
            {installDetails.download_count !== undefined &&
              installDetails.download_count > 0 && (
                <Text size="sm" variant="muted">
                  {tn('%s download', '%s downloads', installDetails.download_count)}
                </Text>
              )}
            <QuietZoneQRCode
              aria-label={t('Install QR Code')}
              value={
                installDetails.platform === 'ios'
                  ? `itms-services://?action=download-manifest&url=${encodeURIComponent(installDetails.install_url)}`
                  : installDetails.install_url
              }
              size={qrSize}
            />
            {details}
            <Flex direction="column" maxWidth="300px" gap="xl" paddingTop="xl">
              <Text align="center" size="lg">
                {t(
                  'Scan the QR code with your device and follow the installation prompts'
                )}
              </Text>
            </Flex>
          </Stack>
          <Flex align="center" gap="md" width="100%">
            <Separator
              orientation="horizontal"
              border="primary"
              style={{flex: 1, margin: 'auto'}}
            />
            <Text size="sm" variant="muted">
              {t('OR')}
            </Text>
            <Separator
              orientation="horizontal"
              border="primary"
              style={{flex: 1, margin: 'auto'}}
            />
          </Flex>
          <Stack align="center" gap="lg">
            <Flex gap="md">
              <Button
                onClick={() => window.open(installDetails.install_url, '_blank')}
                priority="primary"
                size="md"
              >
                {t('Download')}
              </Button>
              {installDetails.install_url && (
                <Tooltip title={t('Copy Download Link')}>
                  <Button
                    aria-label={t('Copy Download Link')}
                    icon={<IconLink />}
                    size="md"
                    onClick={() =>
                      copy(installDetails.install_url!, {
                        successMessage: t('Copied Download Link'),
                      })
                    }
                  />
                </Tooltip>
              )}
            </Flex>
            <Text align="center" size="md" variant="muted">
              {t('The install link will expire in 12 hours')}
            </Text>
          </Stack>
          {installDetails.release_notes && (
            <Flex direction="column" gap="md" width="100%">
              <Heading as="h3">{t('Release Notes')}</Heading>
              <Container
                padding="xl"
                background="secondary"
                border="primary"
                radius="md"
                width="100%"
              >
                <MarkedText text={installDetails.release_notes} />
              </Container>
            </Flex>
          )}
        </Fragment>
      </Flex>
    </Fragment>
  );
}

function CodeSignatureInfo({children}: {children: ReactNode}) {
  return (
    <Container
      padding="md"
      background="secondary"
      border="primary"
      radius="md"
      width="100%"
      style={{textAlign: 'center', wordBreak: 'break-word', overflowWrap: 'break-word'}}
    >
      {children}
    </Container>
  );
}
