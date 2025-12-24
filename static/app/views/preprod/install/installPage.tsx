import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {QuietZoneQRCode} from 'sentry/components/quietZoneQRCode';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {CodeSignatureInfo} from 'sentry/views/preprod/components/installModal';
import {BuildInstallHeader} from 'sentry/views/preprod/install/buildInstallHeader';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {InstallDetailsApiResponse} from 'sentry/views/preprod/types/installDetailsTypes';

interface InstallContentProps {
  error: RequestError | null;
  installDetails: InstallDetailsApiResponse | undefined;
  isError: boolean;
  isPending: boolean;
  onRetry: () => void;
}

function InstallContent({
  installDetails,
  isPending,
  isError,
  error,
  onRetry,
}: InstallContentProps) {
  const details = installDetails?.is_code_signature_valid !== undefined && (
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
      {installDetails.code_signature_errors &&
        installDetails.code_signature_errors.length > 0 && (
          <div style={{marginTop: space(1)}}>
            <Text size="sm" variant="danger" style={{marginBottom: space(0.5)}}>
              {t('Code Signature Errors:')}
            </Text>
            {installDetails.code_signature_errors.map((e, index) => (
              <Text
                key={index}
                size="sm"
                variant="danger"
                style={{display: 'block', marginBottom: space(0.25)}}
              >
                • {e}
              </Text>
            ))}
          </div>
        )}
    </CodeSignatureInfo>
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
        <Button onClick={onRetry}>{t('Retry')}</Button>
      </Flex>
    );
  }

  if (!installDetails) {
    return (
      <Flex direction="column" align="center" gap="md" style={{padding: space(4)}}>
        <Text>{t('No install details available')}</Text>
      </Flex>
    );
  }

  return (
    <Fragment>
      <Flex direction="column" align="center" gap="lg" style={{padding: space(4)}}>
        <Flex direction="column" align="center" gap="sm">
          <Heading as="h3">{t('Install App')}</Heading>
          {installDetails.download_count !== undefined &&
            installDetails.download_count > 0 && (
              <Text size="sm" variant="muted">
                {tn('%s download', '%s downloads', installDetails.download_count)}
              </Text>
            )}
        </Flex>

        {installDetails.install_url && (
          <Fragment>
            <QuietZoneQRCode
              aria-label={t('Install QR Code')}
              value={
                installDetails.platform === 'ios'
                  ? `itms-services://?action=download-manifest&url=${encodeURIComponent(installDetails.install_url)}`
                  : installDetails.install_url
              }
              size={200}
            />

            {details}

            <a href={installDetails.install_url}>{t('Download')}</a>
          </Fragment>
        )}
      </Flex>
    </Fragment>
  );
}

export default function InstallPage() {
  const organization = useOrganization();
  const params = useParams<{artifactId: string; projectId: string}>();
  const artifactId = params.artifactId;
  const projectId = params.projectId;

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

  const buildDetailsQuery = useApiQuery<BuildDetailsApiResponse>(
    [
      `/projects/${organization.slug}/${projectId}/preprodartifacts/${artifactId}/build-details/`,
    ],
    {
      staleTime: 0,
      enabled: !!projectId && !!artifactId,
    }
  );

  return (
    <SentryDocumentTitle title="Install">
      <Layout.Page>
        <Layout.Header>
          <BuildInstallHeader
            buildDetailsQuery={buildDetailsQuery}
            projectId={projectId}
          />
        </Layout.Header>

        <Layout.Body>
          <UrlParamBatchProvider>
            <Layout.Main>
              <InstallContent
                installDetails={installDetails}
                isPending={isPending}
                isError={isError}
                error={error}
                onRetry={() => refetch()}
              />
            </Layout.Main>
          </UrlParamBatchProvider>
        </Layout.Body>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
