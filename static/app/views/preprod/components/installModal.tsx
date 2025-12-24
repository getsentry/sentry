import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {openModal} from 'sentry/actionCreators/modal';
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

interface InstallModalProps {
  artifactId: string;
  closeModal: () => void;
  projectId: string;
}

function InstallModal({projectId, artifactId, closeModal}: InstallModalProps) {
  const organization = useOrganization();
  const {copy} = useCopyToClipboard();

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
      <Heading as="h2">{t('Install App')}</Heading>
      <Container
        position="absolute"
        style={{top: '50%', right: 0, transform: 'translateY(-50%)'}}
      >
        <Button
          onClick={closeModal}
          priority="transparent"
          icon={<IconClose />}
          size="sm"
          aria-label={t('Close')}
        />
      </Container>
    </Flex>
  );

  if (isPending) {
    return (
      <Flex direction="column" align="center" gap="xl">
        {header}
        <LoadingIndicator />
        <Text>{t('Loading install details...')}</Text>
      </Flex>
    );
  }

  if (isError || !installDetails) {
    return (
      <Flex direction="column" align="center" gap="xl">
        {header}
        <Text>{t('Error: %s', error?.message || 'Failed to fetch install details')}</Text>
        <Button onClick={() => refetch()}>{t('Retry')}</Button>
      </Flex>
    );
  }

  if (installDetails.codesigning_type === 'appstore') {
    return (
      <Flex direction="column" align="center" gap="xl">
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
        <Flex direction="column" align="center" gap="xl">
          {header}
          <Text>{'Code signature is invalid'}</Text>
          {errors}
        </Flex>
      );
    }
    return (
      <Flex direction="column" align="center" gap="xl">
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
      <Flex direction="column" align="center" gap="xl">
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
              size={120}
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
          <Divider width="100%" justify="center">
            <Container>
              <Text size="sm" variant="muted">
                {t('OR')}
              </Text>
            </Container>
          </Divider>
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
            <ReleaseNotesSection direction="column" gap="md">
              <Heading as="h3">{t('Release Notes')}</Heading>
              <ReleaseNotesContent>
                <MarkedText text={installDetails.release_notes} />
              </ReleaseNotesContent>
            </ReleaseNotesSection>
          )}
        </Fragment>
      </Flex>
    </Fragment>
  );
}

export const CodeSignatureInfo = styled('div')`
  text-align: center;
  padding: ${space(2)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${space(1)};
  border: 1px solid ${p => p.theme.border};
  max-width: 100%;
  word-break: break-word;
  overflow-wrap: break-word;
`;

const Divider = styled(Flex)`
  position: relative;

  &:before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    display: block;
    flex: 1;
    width: 100%;
    height: 1px;
    background: ${p => p.theme.border};
  }

  > * {
    position: relative;
    z-index: 1;
    background: ${p => p.theme.tokens.background.primary};
    padding: 0 ${p => p.theme.space.xl};
  }
`;

const ReleaseNotesSection = styled(Flex)`
  width: 100%;
  margin-top: ${p => p.theme.space.xl};
`;

const ReleaseNotesContent = styled('div')`
  width: 100%;
  padding: ${p => p.theme.space.xl};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.border};
`;

export function openInstallModal(projectId: string, artifactId: string) {
  openModal(
    ({closeModal}) => (
      <InstallModal
        projectId={projectId}
        artifactId={artifactId}
        closeModal={closeModal}
      />
    ),
    {
      modalCss: css`
        max-width: 500px;
      `,
    }
  );
}
