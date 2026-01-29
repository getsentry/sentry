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

  let quotaType: string;

  if (!quotaData.hasSizeQuota && !quotaData.hasDistributionQuota) {
    quotaType = t('Size Analysis and Build Distribution');
  } else if (quotaData.hasSizeQuota) {
    quotaType = t('Build Distribution');
  } else {
    quotaType = t('Size Analysis');
  }

  const link = quotaData.hasSizeQuota
    ? 'https://sentry.io/pricing/'
    : 'https://docs.sentry.io/pricing/#size-analysis';

  return (
    <Alert.Container>
      <Alert variant="warning" system={system}>
        {tct(
          "You've exceeded your [quotaType] quota. See details on getting more quota in the [link:pricing docs].",
          {
            quotaType,
            link: <ExternalLink href={link} />,
          }
        )}
      </Alert>
    </Alert.Container>
  );
}
