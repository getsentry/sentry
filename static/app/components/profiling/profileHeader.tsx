import Button from 'sentry/components/button';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import {Breadcrumb} from 'sentry/components/profiling/breadcrumb';
import {t} from 'sentry/locale';
import {Event} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {
  generateProfileDetailsRouteWithQuery,
  generateProfileFlamechartRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

interface ProfileHeaderProps {
  transaction: Event | null;
}

function ProfileHeader({transaction}: ProfileHeaderProps) {
  const params = useParams();
  const location = useLocation();
  const organization = useOrganization();
  const [profileGroup] = useProfileGroup();

  const transactionName = profileGroup.type === 'resolved' ? profileGroup.data.name : '';
  const profileId = params.eventId ?? '';
  const projectSlug = params.projectId ?? '';

  const transactionTarget = transaction?.id
    ? getTransactionDetailsUrl(organization.slug, `${projectSlug}:${transaction.id}`)
    : null;

  function handleGoToTransaction() {
    trackAdvancedAnalyticsEvent('profiling_views.go_to_transaction', {
      organization,
      source: 'transaction_details',
    });
  }

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumb
          organization={organization}
          trails={[
            {type: 'landing', payload: {query: location.query}},
            {
              type: 'profile summary',
              payload: {
                projectSlug,
                transaction: transactionName,
                query: location.query,
              },
            },
            {
              type: 'flamechart',
              payload: {
                transaction: transactionName,
                profileId,
                projectSlug,
                query: location.query,
                tab: location.pathname.endsWith('details/') ? 'details' : 'flamechart',
              },
            },
          ]}
        />
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        {transactionTarget && (
          <Button size="sm" onClick={handleGoToTransaction} to={transactionTarget}>
            {t('Go to Transaction')}
          </Button>
        )}
      </Layout.HeaderActions>
      <Layout.HeaderNavTabs underlined>
        <li className={location.pathname.endsWith('flamechart/') ? 'active' : undefined}>
          <Link
            to={generateProfileFlamechartRouteWithQuery({
              orgSlug: organization.slug,
              projectSlug,
              profileId,
              query: location.query,
            })}
          >
            {t('Flamechart')}
          </Link>
        </li>
        <li className={location.pathname.endsWith('details/') ? 'active' : undefined}>
          <Link
            to={generateProfileDetailsRouteWithQuery({
              orgSlug: organization.slug,
              projectSlug,
              profileId,
              query: location.query,
            })}
          >
            {t('Details')}
          </Link>
        </li>
      </Layout.HeaderNavTabs>
    </Layout.Header>
  );
}

export {ProfileHeader};
