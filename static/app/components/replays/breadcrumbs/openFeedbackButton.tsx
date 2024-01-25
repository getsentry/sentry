import {LinkButton} from 'sentry/components/button';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

interface Props {
  eventId: string;
  projectSlug: string;
  className?: string;
}

export default function OpenFeedbackButton({className, eventId, projectSlug}: Props) {
  const organization = useOrganization();

  return (
    <LinkButton
      className={className}
      to={{
        pathname: normalizeUrl(`/organizations/${organization.slug}/feedback/`),
        query: {
          projectSlug,
          eventId,
        },
      }}
      role="button"
      size="xs"
      analyticsEventKey="replay.details-feedback-opened"
      analyticsEventName="Replay Details Feedback Opened"
    >
      {t('Open Feedback')}
    </LinkButton>
  );
}
