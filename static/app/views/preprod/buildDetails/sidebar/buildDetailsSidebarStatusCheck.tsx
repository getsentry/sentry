import {Alert} from '@sentry/scraps/alert';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {IconCheckmark, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {
  BuildDetailsVcsInfo,
  StatusCheckResult,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  isStatusCheckFailure,
  isStatusCheckSuccess,
  StatusCheckErrorType,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {getCheckRunUrl} from 'sentry/views/preprod/utils/vcsLinkUtils';

interface BuildDetailsSidebarStatusCheckProps {
  statusCheck: StatusCheckResult | null | undefined;
  vcsInfo: BuildDetailsVcsInfo;
}

export function BuildDetailsSidebarStatusCheck({
  statusCheck,
  vcsInfo,
}: BuildDetailsSidebarStatusCheckProps) {
  if (!statusCheck) {
    return null;
  }

  // Handle failure case
  if (isStatusCheckFailure(statusCheck)) {
    // Don't show error if we don't have provider info
    if (!vcsInfo.provider) {
      return null;
    }

    const providerName = getProviderDisplayName(vcsInfo.provider);
    const errorMessage = getErrorMessage(statusCheck.error_type, providerName);
    return (
      <Alert variant="subtle" showIcon={false}>
        <Flex direction="column" gap="sm">
          <Flex align="center" gap="xs">
            <IconWarning size="xs" color="errorText" />
            <Text size="sm" bold>
              {t('Status check failed to post')}
            </Text>
          </Flex>
          <Text variant="muted" size="xs">
            {errorMessage}
          </Text>
          <Text size="xs">
            <ExternalLink href="https://docs.sentry.io/product/size-analysis/integrating-into-ci/">
              {t('View CI setup docs')}
            </ExternalLink>
          </Text>
        </Flex>
      </Alert>
    );
  }

  // Handle success case
  if (isStatusCheckSuccess(statusCheck)) {
    const checkUrl = getCheckRunUrl(vcsInfo, statusCheck.check_id);

    // Only show success message if we have a check URL to link to
    if (!checkUrl) {
      return null;
    }

    const providerName = getProviderDisplayName(vcsInfo.provider);

    return (
      <Alert variant="subtle" showIcon={false}>
        <Flex align="center" gap="xs">
          <IconCheckmark size="xs" color="successText" />
          <Text size="sm">
            <ExternalLink href={checkUrl}>
              {t('View status check on %s', providerName)}
            </ExternalLink>
          </Text>
        </Flex>
      </Alert>
    );
  }

  return null;
}

function getProviderDisplayName(provider: string | null | undefined): string {
  if (!provider) {
    return 'VCS';
  }
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function getErrorMessage(
  errorType: StatusCheckErrorType | null | undefined,
  providerName: string
): string {
  switch (errorType) {
    case StatusCheckErrorType.INTEGRATION_ERROR:
      return t(
        'An error occured with the %s integration. Please ensure the Sentry app is installed, has the required permissions, and that the organization has accepted any updated permissions.',
        providerName
      );
    case StatusCheckErrorType.API_ERROR:
      return t('A temporary API error occurred while posting the status check.');
    case StatusCheckErrorType.UNKNOWN:
    default:
      return t('An error occurred while posting the status check to %s.', providerName);
  }
}
