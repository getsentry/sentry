import type {Location} from 'history';

import type {ButtonProps} from 'sentry/components/button';
import {LinkButton} from 'sentry/components/button';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  event: EventTransaction;
  projectSlug: string;
  children?: React.ReactNode;
  query?: Location['query'];
  size?: ButtonProps['size'];
}

function TransactionToProfileButton({
  event,
  projectSlug,
  query,
  children = t('View Profile'),
  size = 'sm',
}: Props) {
  const profileId = event.contexts?.profile?.profile_id ?? null;
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
    organization,
    projectSlug,
    profileId,
    query,
  });

  return (
    <LinkButton size={size} onClick={handleGoToProfile} to={target}>
      {children}
    </LinkButton>
  );
}

export {TransactionToProfileButton};
