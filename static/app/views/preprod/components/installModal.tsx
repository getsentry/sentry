import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {QRCodeCanvas} from 'qrcode.react';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
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
      <Flex direction="column" align="center" gap="md" style={{padding: space(4)}}>
        <LoadingIndicator />
        <Text>{t('Loading install details...')}</Text>
      </Flex>
    );
  }

  if (isError) {
    return (
      <Flex direction="column" align="center" gap="md" style={{padding: space(4)}}>
        <Text>{t('Error: %s', error?.message || 'Failed to fetch install details')}</Text>
        <Button onClick={() => refetch()}>{t('Retry')}</Button>
        <Button onClick={closeModal}>{t('Close')}</Button>
      </Flex>
    );
  }

  if (!installDetails) {
    return (
      <Flex direction="column" align="center" gap="md" style={{padding: space(4)}}>
        <Text>{t('No install details available')}</Text>
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
      {installDetails.codesigning_type && (
        <Text size="sm" variant="muted" style={{marginBottom: space(0.5)}}>
          {t('Type: %s', installDetails.codesigning_type)}
        </Text>
      )}
    </CodeSignatureInfo>
  );

  return (
    <Fragment>
      <Flex direction="column" align="center" gap="lg" style={{padding: space(4)}}>
        <Heading as="h3">{t('Install App')}</Heading>

        {installDetails.install_url && (
          <Fragment>
            <QRCodeContainer>
              <StyledQRCode
                aria-label={t('Install QR Code')}
                value={installDetails.install_url}
                size={200}
              />
            </QRCodeContainer>

            {details}

            <Flex direction="column" style={{textAlign: 'left', maxWidth: '300px'}}>
              <Text bold style={{marginBottom: space(1)}}>
                {t('Instructions:')}
              </Text>
              <InstructionList>
                <li>{t('Scan the QR code with your device')}</li>
                <li>{t('Follow the installation prompts')}</li>
                <li>{t('The install link will expire in 12 hours')}</li>
              </InstructionList>
            </Flex>
          </Fragment>
        )}

        <Button onClick={closeModal} priority="primary">
          {t('Close')}
        </Button>
      </Flex>
    </Fragment>
  );
}

const QRCodeContainer = styled('div')`
  background: white;
  padding: ${space(2)};
  border-radius: ${space(1)};
  border: 1px solid ${p => p.theme.border};
`;

const StyledQRCode = styled(QRCodeCanvas)`
  display: block;
`;

const CodeSignatureInfo = styled('div')`
  text-align: center;
  padding: ${space(2)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${space(1)};
  border: 1px solid ${p => p.theme.border};
`;

const InstructionList = styled('ul')`
  margin: 0;
  padding-left: ${space(2)};
  color: ${p => p.theme.subText};

  li {
    margin-bottom: ${space(0.5)};
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
