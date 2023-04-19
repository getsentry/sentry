import {Location} from 'history';

import {Button, ButtonProps} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';

import {useTransactionProfileId} from './transactionProfileIdProvider';

interface Props {
  projectSlug: string;
  children?: React.ReactNode;
  query?: Location['query'];
  size?: ButtonProps['size'];
}

function TransactionToProfileButton({
  projectSlug,
  query,
  children = t('View Profile'),
  size = 'sm',
}: Props) {
  const profileId = useTransactionProfileId();
  const organization = useOrganization();

  if (!profileId) {
    return null;
  }

  function handleGoToProfile() {
    trackAnalytics('profiling_views.go_to_flamegraph', {
      organization,
      source: 'transaction_details',
    });
  }

  const target = generateProfileFlamechartRouteWithQuery({
    orgSlug: organization.slug,
    projectSlug,
    profileId,
    query,
  });

  return (
    <Button size={size} onClick={handleGoToProfile} to={target}>
      {children}
    </Button>
  );
}

export {TransactionToProfileButton};
