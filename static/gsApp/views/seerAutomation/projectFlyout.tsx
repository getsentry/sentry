import {useEffect, useRef} from 'react';

import {DrawerBody, DrawerHeader, useDrawer} from '@sentry/scraps/drawer';
import {Flex} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {NotFound} from 'sentry/components/errors/notFound';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SeerProjectDetails} from 'sentry/components/seer/projectDetails';
import {t, tct} from 'sentry/locale';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

export default function SeerProjectFlyout() {
  const {query} = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {projectSlug} = useParams<{projectSlug: string}>();
  const {data: project, isPending: fetching} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug,
  });
  const {openDrawer} = useDrawer();

  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    openDrawer(
      () => (
        <AnalyticsArea name="project-details">
          <DrawerHeader>
            {project && (
              <Flex gap="sm">
                {tct('Seer settings for [project]', {
                  project: <ProjectBadge project={project} avatarSize={16} />,
                })}
              </Flex>
            )}
          </DrawerHeader>
          <DrawerBody>
            {fetching ? (
              <LoadingIndicator />
            ) : project ? (
              <SeerProjectDetails project={project} />
            ) : (
              <NotFound />
            )}
          </DrawerBody>
        </AnalyticsArea>
      ),
      {
        ariaLabel: t('Project Details'),
        drawerKey: 'project-details-drawer',
        resizable: true,
        onClose: () => {
          navigate({
            pathname: `/settings/${organization.slug}/seer/projects/`,
            query: queryRef.current,
          });
        },
        shouldCloseOnLocationChange: nextLocation =>
          !nextLocation.pathname.endsWith(`/seer/projects/${projectSlug}/`),
      }
    );
  }, [fetching, navigate, openDrawer, organization, project, projectSlug]);

  return null;
}
