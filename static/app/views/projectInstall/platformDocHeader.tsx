import {useCallback} from 'react';
import {useBlocker} from 'react-router-dom';
import styled from '@emotion/styled';

import {removeProject} from 'sentry/actionCreators/projects';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {useRecentCreatedProject} from 'sentry/components/onboarding/useRecentCreatedProject';
import type {Platform} from 'sentry/data/platformPickerCategories';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

type Props = {
  platform: Platform;
  projectSlug: Project['slug'];
  title?: string;
};

export function PlatformDocHeader({platform, projectSlug, title}: Props) {
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});
  const router = useRouter();

  const {project: recentCreatedProject, isProjectActive} = useRecentCreatedProject({
    orgSlug: organization.slug,
    projectSlug,
  });

  const handleGoBack = useCallback(async () => {
    if (!recentCreatedProject) {
      return;
    }

    trackAnalytics('project_creation.back_button_clicked', {
      organization,
    });

    if (!isProjectActive) {
      trackAnalytics('project_creation.data_removal_modal_confirm_button_clicked', {
        organization,
        platform: recentCreatedProject.slug,
        project_id: recentCreatedProject.id,
      });

      try {
        await removeProject({
          api,
          orgSlug: organization.slug,
          projectSlug: recentCreatedProject.slug,
          origin: 'getting_started',
        });

        trackAnalytics('project_creation.data_removed', {
          organization,
          date_created: recentCreatedProject.dateCreated,
          platform: recentCreatedProject.slug,
          project_id: recentCreatedProject.id,
        });
      } catch (error) {
        handleXhrErrorResponse('Unable to delete project in project creation', error);
        // we don't give the user any feedback regarding this error as this shall be silent
      }
    }

    router.replace(
      makeProjectsPathname({
        path: '/new/',
        organization,
      }) + `?referrer=getting-started&project=${recentCreatedProject.id}`
    );
  }, [api, recentCreatedProject, organization, isProjectActive, router]);

  useBlocker(({historyAction}) => {
    if (historyAction === 'POP') {
      handleGoBack();
    }
    return false;
  });

  return (
    <StyledPageHeader>
      <h2>
        {title ?? t('Configure %(platform)s SDK', {platform: platform.name ?? 'other'})}
      </h2>
      <ButtonBar>
        <Button
          size="sm"
          icon={<IconChevron direction="left" size="xs" />}
          onClick={handleGoBack}
        >
          {t('Back to Platform Selection')}
        </Button>
        {platform.key !== 'other' && (
          <LinkButton size="sm" href={platform.link ?? ''} external>
            {t('Full Documentation')}
          </LinkButton>
        )}
      </ButtonBar>
    </StyledPageHeader>
  );
}

const StyledPageHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(3)};

  h2 {
    margin: 0;
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex-direction: column;
    align-items: flex-start;

    h2 {
      margin-bottom: ${space(2)};
    }
  }
`;
