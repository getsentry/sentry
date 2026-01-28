import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function PreprodQuotaAlert({system}: {system?: boolean}) {
  const organization = useOrganization();

  const {data: quotaData} = useApiQuery<{
    hasDistributionQuota: boolean;
    hasSizeQuota: boolean;
  }>([`/organizations/${organization.slug}/preprod/quota/`], {staleTime: 0});

  const isOutOfQuota =
    quotaData && (!quotaData.hasSizeQuota || !quotaData.hasDistributionQuota);

  if (!isOutOfQuota) {
    return null;
  }

  let message: string;

  if (!quotaData.hasSizeQuota && !quotaData.hasDistributionQuota) {
    message = t("You've exceeded your size analysis and build distribution quota.");
  } else if (quotaData.hasSizeQuota) {
    message = t("You've exceeded your build distribution quota.");
  } else {
    message = t("You've exceeded your size analysis quota.");
  }

  return (
    <Alert.Container>
      <Alert variant="warning" system={system}>
        {tct('[message] [link:Get more.]', {
          message,
          link: <ExternalLink href="https://sentry.io/pricing/" />,
        })}
      </Alert>
    </Alert.Container>
  );
}
