import {Link} from 'react-router';

import * as Layout from 'sentry/components/layouts/thirds';
import {Breadcrumb} from 'sentry/components/profiling/breadcrumb';
import {t} from 'sentry/locale';
import {
  generateProfileDetailsRouteWithQuery,
  generateProfileFlamechartRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

function ProfileHeader() {
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
              type: 'flamechart',
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
        <li className={location.pathname.endsWith('details/') ? 'active' : undefined}>
          <Link
            to={generateProfileDetailsRouteWithQuery({
              orgSlug: organization.slug,
              projectSlug: params.projectId,
              profileId: params.eventId,
              location,
            })}
          >
            {t('Details')}
          </Link>
        </li>
        <li className={location.pathname.endsWith('flamechart/') ? 'active' : undefined}>
          <Link
            to={generateProfileFlamechartRouteWithQuery({
              orgSlug: organization.slug,
              projectSlug: params.projectId,
              profileId: params.eventId,
              location,
            })}
          >
            {t('Flamechart')}
          </Link>
        </li>
      </Layout.HeaderNavTabs>
    </Layout.Header>
  );
}

export {ProfileHeader};
