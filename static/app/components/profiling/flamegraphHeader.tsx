import {Link} from 'react-router';

import * as Layout from 'sentry/components/layouts/thirds';
import {Breadcrumb} from 'sentry/components/profiling/breadcrumb';
import {t} from 'sentry/locale';
import {
  generateFlamegraphRouteWithQuery,
  generateFlamegraphSummaryRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

function FlamegraphHeader() {
  const params = useParams();
  const location = useLocation();
  const organization = useOrganization();
  const [profileGroup] = useProfileGroup();

  return (
    <Layout.Header style={{gridTemplateColumns: 'minmax(0, 1fr)'}}>
      <Layout.HeaderContent style={{marginBottom: 0}}>
        <Breadcrumb
          location={location}
          organization={organization}
          trails={[
            {type: 'landing'},
            {
              type: 'flamegraph',
              payload: {
                transaction:
                  profileGroup.type === 'resolved' ? profileGroup.data.name : '',
                profileId: params.eventId ?? '',
                projectSlug: params.projectId ?? '',
              },
            },
          ]}
        />
      </Layout.HeaderContent>
      <Layout.HeaderNavTabs underlined>
        <li className={location.pathname.endsWith('summary/') ? 'active' : undefined}>
          <Link
            to={generateFlamegraphSummaryRouteWithQuery({
              orgSlug: organization.slug,
              projectSlug: params.projectId,
              profileId: params.eventId,
              location,
            })}
          >
            {t('Summary')}
          </Link>
        </li>
        <li className={location.pathname.endsWith('flamegraph/') ? 'active' : undefined}>
          <Link
            to={generateFlamegraphRouteWithQuery({
              orgSlug: organization.slug,
              projectSlug: params.projectId,
              profileId: params.eventId,
              location,
            })}
          >
            {t('Flamegraph')}
          </Link>
        </li>
      </Layout.HeaderNavTabs>
    </Layout.Header>
  );
}

export {FlamegraphHeader};
