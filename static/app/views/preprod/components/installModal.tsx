import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {QRCodeCanvas} from 'qrcode.react';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
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
        <div>{t('Loading install details...')}</div>
      </Flex>
    );
  }

  if (isError) {
    return (
      <Flex direction="column" align="center" gap="md" style={{padding: space(4)}}>
        <div>{t('Error: %s', error?.message || 'Failed to fetch install details')}</div>
        <Button onClick={() => refetch()}>{t('Retry')}</Button>
        <Button onClick={closeModal}>{t('Close')}</Button>
      </Flex>
    );
  }

  if (!installDetails) {
    return (
      <Flex direction="column" align="center" gap="md" style={{padding: space(4)}}>
        <div>{t('No install details available')}</div>
        <Button onClick={closeModal}>{t('Close')}</Button>
      </Flex>
    );
  }

  const details = installDetails.is_code_signature_valid !== undefined && (
    <CodeSignatureInfo>
      {installDetails.profile_name && (
        <CodeSignatureValue>
          {t('Profile: %s', installDetails.profile_name)}
        </CodeSignatureValue>
      )}
      {installDetails.codesigning_type && (
        <CodeSignatureValue>
          {t('Type: %s', installDetails.codesigning_type)}
        </CodeSignatureValue>
      )}
    </CodeSignatureInfo>
  );

  return (
    <Fragment>
      <Flex direction="column" align="center" gap="lg" style={{padding: space(4)}}>
        <Title>{t('Install App')}</Title>

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

            <Instructions>
              <InstructionTitle>{t('Instructions:')}</InstructionTitle>
              <InstructionList>
                <li>{t('Scan the QR code with your device')}</li>
                <li>{t('Follow the installation prompts')}</li>
                <li>{t('The install link will expire in 12 hours')}</li>
              </InstructionList>
            </Instructions>
          </Fragment>
        )}

        <Button onClick={closeModal} priority="primary">
          {t('Close')}
        </Button>
      </Flex>
    </Fragment>
  );
}

const Title = styled('h3')`
  margin: 0;
  font-size: 18px;
  font-weight: 600;
`;

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

const CodeSignatureValue = styled('div')`
  font-size: 14px;
  color: ${p => p.theme.subText};
  margin-bottom: ${space(0.5)};
`;

const Instructions = styled('div')`
  text-align: left;
  max-width: 300px;
`;

const InstructionTitle = styled('div')`
  font-weight: 600;
  margin-bottom: ${space(1)};
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
