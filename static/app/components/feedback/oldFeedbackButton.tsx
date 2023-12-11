import {LinkButton} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

export default function OldFeedbackButton() {
  const location = useLocation();
  const organization = useOrganization();

  return (
    <Tooltip
      title={tct('View [link:error-associated feedback reports].', {
        link: (
          <ExternalLink href="https://docs.sentry.io/product/user-feedback/#crash-report-modal" />
        ),
      })}
      position="left"
      isHoverable
    >
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
    </Tooltip>
  );
}
