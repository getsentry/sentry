import {useCallback} from 'react';
import styled from '@emotion/styled';

import {removeProject} from 'sentry/actionCreators/projects';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import {useRecentCreatedProject} from 'sentry/components/onboarding/useRecentCreatedProject';
import type {Platform} from 'sentry/data/platformPickerCategories';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';

type Props = {
  platform: Platform;
  projectSlug: Project['slug'];
  title?: string;
};

export function PlatformDocHeader({platform, projectSlug, title}: Props) {
  const organization = useOrganization();
  const api = useApi();
  const router = useRouter();

  const {project: recentCreatedProject, isProjectActive} = useRecentCreatedProject({
    orgSlug: organization.slug,
    projectSlug,
  });

  const shallProjectBeDeleted = !isProjectActive;

  const handleGoBack = useCallback(async () => {
    if (!recentCreatedProject) {
      return;
    }

    trackAnalytics('project_creation.back_button_clicked', {
      organization,
    });

    if (shallProjectBeDeleted) {
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
      normalizeUrl(
        `/organizations/${organization.slug}/projects/new/?referrer=getting-started&project=${recentCreatedProject.id}`
      )
    );
  }, [api, recentCreatedProject, organization, shallProjectBeDeleted, router]);

  return (
    <StyledPageHeader>
      <h2>
        {title ?? t('Configure %(platform)s SDK', {platform: platform.name ?? 'other'})}
      </h2>
      <ButtonBar gap={1}>
        <Confirm
          bypass={!shallProjectBeDeleted}
          message={t(
            "Hey, just a heads up - we haven't received any data for this SDK yet and by going back all changes will be discarded. Are you sure you want to head back?"
          )}
          priority="danger"
          confirmText={t("Yes I'm sure")}
          onConfirm={handleGoBack}
          onCancel={() => {
            if (!recentCreatedProject) {
              return;
            }
            trackAnalytics('project_creation.data_removal_modal_dismissed', {
              organization,
              platform: recentCreatedProject.slug,
              project_id: recentCreatedProject.id,
            });
          }}
          onRender={() => {
            if (!recentCreatedProject) {
              return;
            }
            trackAnalytics('project_creation.data_removal_modal_rendered', {
              organization,
              platform: recentCreatedProject.slug,
              project_id: recentCreatedProject.id,
            });
          }}
        >
          <Button icon={<IconChevron direction="left" size="sm" />} size="sm">
            {t('Back to Platform Selection')}
          </Button>
        </Confirm>
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

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
    align-items: flex-start;

    h2 {
      margin-bottom: ${space(2)};
    }
  }
`;
