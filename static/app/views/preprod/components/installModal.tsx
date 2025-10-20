import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {QRCodeCanvas} from 'qrcode.react';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Container, Flex, Stack} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {InstallDetailsApiResponse} from 'sentry/views/preprod/types/installDetailsTypes';

interface InstallModalProps {
  artifactId: string;
  closeModal: () => void;
  projectId: string;
}

function InstallModal({projectId, artifactId, closeModal}: InstallModalProps) {
  const organization = useOrganization();

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

  if (isPending) {
    return (
      <Flex direction="column" align="center" gap="md" padding="3xl">
        <LoadingIndicator />
        <Text>{t('Loading install details...')}</Text>
      </Flex>
    );
  }

  if (isError) {
    return (
      <Flex direction="column" align="center" gap="md" padding="3xl">
        <Text>{t('Error: %s', error?.message || 'Failed to fetch install details')}</Text>
        <Button onClick={() => refetch()}>{t('Retry')}</Button>
        <Button onClick={closeModal}>{t('Close')}</Button>
      </Flex>
    );
  }

  if (!installDetails?.install_url) {
    const message = installDetails
      ? t('No install download link available')
      : t('No install details available');
    return (
      <Flex direction="column" align="center" gap="md" padding="3xl">
        <Text>{message}</Text>
        <Button onClick={closeModal}>{t('Close')}</Button>
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

        <Fragment>
          <Stack align="center" gap="md">
            {installDetails.download_count !== undefined &&
              installDetails.download_count > 0 && (
                <Text size="sm" variant="muted">
                  {tn('%s download', '%s downloads', installDetails.download_count)}
                </Text>
              )}
            <Container background="secondary" padding="lg" radius="md" border="primary">
              <StyledQRCode
                aria-label={t('Install QR Code')}
                value={
                  installDetails.platform === 'ios'
                    ? `itms-services://?action=download-manifest&url=${encodeURIComponent(installDetails.install_url)}`
                    : installDetails.install_url
                }
                size={120}
              />
            </Container>
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
            <Button
              onClick={() => window.open(installDetails.install_url, '_blank')}
              priority="primary"
              size="md"
            >
              {t('Download')}
            </Button>
            <Text align="center" size="md" variant="muted">
              {t('The install link will expire in 12 hours')}
            </Text>
          </Stack>
        </Fragment>
      </Flex>
    </Fragment>
  );
}

const StyledQRCode = styled(QRCodeCanvas)`
  display: block;
`;

export const CodeSignatureInfo = styled('div')`
  text-align: center;
  padding: ${space(2)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${space(1)};
  border: 1px solid ${p => p.theme.border};
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
    background: ${p => p.theme.background};
    padding: 0 ${p => p.theme.space.xl};
  }
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
