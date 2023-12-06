import {LinkButton} from 'sentry/components/button';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

export default function OldFeedbackButton() {
  const location = useLocation();
  const organization = useOrganization();

  return (
    <LinkButton
      analyticsEventName="Clicked Go To Old User Feedback Button"
      analyticsEventKey="feedback.index-old-ui-clicked"
      size="sm"
      priority="default"
      to={{
        pathname: normalizeUrl(`/organizations/${organization.slug}/user-feedback/`),
        query: {
          ...location.query,
          query: undefined,
          cursor: undefined,
        },
      }}
    >
      {t('Go to Old User Feedback')}
    </LinkButton>
  );
}
