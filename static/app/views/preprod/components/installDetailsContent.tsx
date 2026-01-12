import {Fragment, type ReactNode} from 'react';

import {Button} from '@sentry/scraps/button';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Container, Flex, Stack} from 'sentry/components/core/layout';
import {Separator} from 'sentry/components/core/separator';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {QuietZoneQRCode} from 'sentry/components/quietZoneQRCode';
import {IconLink} from 'sentry/icons';
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
  size?: 'sm' | 'lg';
}

export function InstallDetailsContent({
  projectId,
  artifactId,
  size = 'sm',
}: InstallDetailsContentProps) {
  const organization = useOrganization();
  const {copy} = useCopyToClipboard();
  const isLarge = size === 'lg';
  const qrSize = isLarge ? 200 : 120;
  const outerGap = isLarge ? 'lg' : 'xl';

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

  let body: ReactNode;
  if (isPending) {
    body = (
      <Flex direction="column" align="center" gap={outerGap}>
        <LoadingIndicator />
        <Text>{t('Loading install details...')}</Text>
      </Flex>
    );
  } else if (isError || !installDetails) {
    body = (
      <Flex direction="column" align="center" gap={outerGap}>
        <Text>{t('Error: %s', error?.message || 'Failed to fetch install details')}</Text>
        <Button onClick={() => refetch()}>{t('Retry')}</Button>
      </Flex>
    );
  } else if (installDetails.codesigning_type === 'appstore') {
    body = (
      <Flex direction="column" align="center" gap={outerGap}>
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
  } else if (installDetails.install_url) {
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

    body = (
      <Flex direction="column" align="center" gap={outerGap} width="100%">
        <Fragment>
          <Stack align="center" gap="md">
            {installDetails.download_count !== undefined &&
              installDetails.download_count > 0 && (
                <Text size="sm" variant="muted">
                  {tn('%s download', '%s downloads', installDetails.download_count)}
                </Text>
              )}
            <Container display={{xs: 'none', sm: 'block'}}>
              <QuietZoneQRCode
                aria-label={t('Install QR Code')}
                value={
                  installDetails.platform === 'ios'
                    ? `itms-services://?action=download-manifest&url=${encodeURIComponent(installDetails.install_url)}`
                    : installDetails.install_url
                }
                size={qrSize}
              />
            </Container>
            {details}
            <Container display={{xs: 'none', sm: 'block'}}>
              <Flex direction="column" maxWidth="300px" gap="xl" paddingTop="xl">
                <Text align="center" size="lg">
                  {t(
                    'Scan the QR code with your device and follow the installation prompts'
                  )}
                </Text>
              </Flex>
            </Container>
          </Stack>
          <Container display={{xs: 'none', sm: 'block'}} width="100%">
            <Flex align="center" gap="md" width="100%">
              <Separator
                orientation="horizontal"
                border="muted"
                style={{flex: 1, margin: 'auto'}}
              />
              <Text size="sm" variant="muted">
                {t('OR')}
              </Text>
              <Separator
                orientation="horizontal"
                border="muted"
                style={{flex: 1, margin: 'auto'}}
              />
            </Flex>
          </Container>
          <Stack align="center" gap="lg">
            <Flex
              gap="md"
              width="100%"
              direction={{xs: 'column', sm: 'row'}}
              justify="center"
              align={{xs: 'stretch', sm: 'center'}}
            >
              <Flex width={{xs: '100%', sm: 'auto'}}>
                <Button
                  onClick={() => window.open(installDetails.install_url, '_blank')}
                  priority="primary"
                  size="md"
                  style={{width: '100%'}}
                >
                  {t('Download')}
                </Button>
              </Flex>
              {installDetails.install_url && (
                <Flex
                  alignSelf={{xs: 'stretch', sm: 'center'}}
                  width={{xs: '100%', sm: 'auto'}}
                >
                  <Container display={{xs: 'block', sm: 'none'}} width="100%">
                    <Button
                      onClick={() =>
                        copy(installDetails.install_url!, {
                          successMessage: t('Copied Download Link'),
                        })
                      }
                      size="md"
                      priority="default"
                      style={{width: '100%'}}
                    >
                      {t('Copy Download Link')}
                    </Button>
                  </Container>
                  <Container display={{xs: 'none', sm: 'block'}}>
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
                  </Container>
                </Flex>
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
    );
  } else {
    if (installDetails.is_code_signature_valid) {
      body = (
        <Flex direction="column" align="center" gap={outerGap}>
          <Text>{t('No install download link available')}</Text>
        </Flex>
      );
    } else {
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
      body = (
        <Flex direction="column" align="center" gap={outerGap}>
          <Text>{'Code signature is invalid'}</Text>
          {errors}
        </Flex>
      );
    }
  }

  return body;
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
