import {useCallback} from 'react';
import {useBlocker} from 'react-router-dom';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Flex, Grid} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {removeProject} from 'sentry/actionCreators/projects';
import {useRecentCreatedProject} from 'sentry/components/onboarding/useRecentCreatedProject';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import type {PlatformIntegration, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {ProjectCreationVariant} from 'sentry/utils/analytics/projectCreationAnalyticsEvents';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

type Props = {
  platform: PlatformIntegration;
  projectSlug: Project['slug'];
  /**
   * When this getting-started page was reached from project creation, the
   * create form stamps `?projectCreationVariant=scm|legacy`. Stamp that onto
   * the three header events so abandonment can be segmented. Unmarked entry
   * points (older projects, peripheral links) keep firing the same
   * `project_creation.*` names without a variant guess.
   */
  projectCreationVariant?: ProjectCreationVariant;
};

export function PlatformDocHeader({
  platform,
  projectSlug,
  projectCreationVariant,
}: Props) {
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});
  const navigate = useNavigate();

  const {project: recentCreatedProject, isProjectActive} = useRecentCreatedProject({
    orgSlug: organization.slug,
    projectSlug,
  });

  const handleGoBack = useCallback(async () => {
    if (!recentCreatedProject) {
      return;
    }

    const variantParams = projectCreationVariant ? {variant: projectCreationVariant} : {};

    trackAnalytics('project_creation.back_button_clicked', {
      organization,
      ...variantParams,
    });

    if (!isProjectActive) {
      trackAnalytics('project_creation.data_removal_modal_confirm_button_clicked', {
        organization,
        platform: platform.id,
        project_id: recentCreatedProject.id,
        ...variantParams,
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
          platform: platform.id,
          project_id: recentCreatedProject.id,
          ...variantParams,
        });
      } catch (error) {
        handleXhrErrorResponse(
          'Unable to delete project in project creation',
          error as RequestError
        );
        // we don't give the user any feedback regarding this error as this shall be silent
      }
    }

    navigate(
      makeProjectsPathname({
        path: '/new/',
        organization,
      }) + `?referrer=getting-started&project=${recentCreatedProject.id}`,
      {replace: true}
    );
  }, [
    api,
    recentCreatedProject,
    organization,
    isProjectActive,
    navigate,
    projectCreationVariant,
    platform.id,
  ]);

  useBlocker(({historyAction}) => {
    if (historyAction === 'POP') {
      handleGoBack();
    }
    return false;
  });

  return (
    <Flex
      direction={{zero: 'column', xl: 'row'}}
      align="start"
      justify="between"
      gap={{zero: 'xl', xl: '0'}}
      marginBottom="2xl"
    >
      <Heading as="h2">
        {t('Configure %(platform)s SDK', {platform: platform.name ?? 'other'})}
      </Heading>
      <Grid flow="column" align="center" gap="md">
        <Button
          size="sm"
          icon={<IconChevron direction="left" size="xs" />}
          onClick={handleGoBack}
        >
          {t('Back to Platform Selection')}
        </Button>
        {platform.id !== 'other' && (
          <LinkButton size="sm" href={platform.link ?? ''} external>
            {t('Full Documentation')}
          </LinkButton>
        )}
      </Grid>
    </Flex>
  );
}
