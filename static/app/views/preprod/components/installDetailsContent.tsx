import {Fragment, type ReactNode} from 'react';
import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {QuietZoneQRCode} from 'sentry/components/quietZoneQRCode';
import {IconLink} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {InstallDetailsApiResponse} from 'sentry/views/preprod/types/installDetailsTypes';

export function getDistributionErrorTooltip(
  errorCode?: string | null,
  errorMessage?: string | null
): string {
  // Legacy rows: before the granular codes existed, the reason was stuffed into
  // error_message as a short-code string. Translate those to real sentences.
  // Drop once launchpad has been emitting the new codes long enough that old
  // rows have aged out.
  if (errorCode === 'skipped') {
    if (errorMessage === 'invalid_signature') {
      return t('Code signature is invalid');
    }
    if (errorMessage === 'simulator') {
      return t('Simulator builds cannot be distributed');
    }
  }

  return errorMessage || t('Not installable');
}

interface InstallDetailsContentProps {
  artifactId: string;
  projectSlug: string;
  distributionErrorCode?: string | null;
  distributionErrorMessage?: string | null;
  size?: 'sm' | 'lg';
}

export function InstallDetailsContent({
  artifactId,
  projectSlug,
  size = 'sm',
  distributionErrorCode,
  distributionErrorMessage,
}: InstallDetailsContentProps) {
  const theme = useTheme();
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
      getApiUrl(
        '/organizations/$organizationIdOrSlug/preprodartifacts/$headArtifactId/private-install-details/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            headArtifactId: artifactId,
          },
        }
      ),
    ],
    {
      staleTime: 0,
      retry: (failureCount, apiError: RequestError) => {
        if (apiError?.status === 404) {
          return false;
        }
        return failureCount < 2;
      },
    }
  );

  const distributionDisabledBody = (
    <Flex direction="column" align="center" gap={outerGap}>
      <Text>{t('Build distribution is not enabled')}</Text>
      <Text size="sm" variant="muted" align="center">
        {tct(
          'The installable file is not available for this build. Enable build distribution in your [link:project settings].',
          {
            link: (
              <Link
                to={`/settings/${organization.slug}/projects/${projectSlug}/mobile-builds/?tab=distribution`}
              />
            ),
          }
        )}
      </Text>
    </Flex>
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
    if (error?.status === 404) {
      // 404 means there's no installable file. Use the error_code/message the
      // parent passes from build-details to explain why — only show the
      // settings link when distribution is actually disabled for the project.
      if (distributionErrorCode === 'distribution_disabled') {
        body = distributionDisabledBody;
      } else {
        const message = distributionErrorCode
          ? getDistributionErrorTooltip(distributionErrorCode, distributionErrorMessage)
          : t('No install download link available');
        body = (
          <Flex direction="column" align="center" gap={outerGap}>
            <Text>{message}</Text>
          </Flex>
        );
      }
    } else {
      body = (
        <Flex direction="column" align="center" gap={outerGap}>
          <Text>
            {t('Error: %s', error?.message || 'Failed to fetch install details')}
          </Text>
          <Button onClick={() => refetch()}>{t('Retry')}</Button>
        </Flex>
      );
    }
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
          <Text size="sm" variant="muted" style={{marginBottom: theme.space.xs}}>
            {t('Profile: %s', installDetails.profile_name)}
          </Text>
        )}
        {installDetails.profile_name && installDetails.codesigning_type && <br />}
        {installDetails.codesigning_type && (
          <Text size="sm" variant="muted" style={{marginBottom: theme.space.xs}}>
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
                  installDetails.platform === 'apple'
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
  } else if (distributionErrorCode === 'distribution_disabled') {
    body = distributionDisabledBody;
  } else {
    let message: string;
    if (distributionErrorCode) {
      message = getDistributionErrorTooltip(
        distributionErrorCode,
        distributionErrorMessage
      );
    } else if (installDetails.is_code_signature_valid === false) {
      message = t('Code signature is invalid');
    } else {
      message = t('No install download link available');
    }

    body = (
      <Flex direction="column" align="center" gap={outerGap}>
        <Text>{message}</Text>
        {installDetails.code_signature_errors &&
          installDetails.code_signature_errors.length > 0 && (
            <CodeSignatureInfo>
              <Stack gap="sm">
                {installDetails.code_signature_errors.map((e, index) => (
                  <Text key={index}>{e}</Text>
                ))}
              </Stack>
            </CodeSignatureInfo>
          )}
      </Flex>
    );
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
