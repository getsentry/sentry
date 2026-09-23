import {Fragment} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import {LinkButton} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';
import {Image} from '@sentry/scraps/image';
import {Link} from '@sentry/scraps/link';

import {CreateSampleEventButton} from 'sentry/components/onboarding/createSampleEventButton';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

type Props = {
  org: Organization;
  project?: Project;
  /**
   * sampleIssueId can have 3 values:
   * - empty string to indicate it doesn't exist (render "create sample event")
   * - non-empty string to indicate it exists (render "see sample event")
   * - undefined to indicate the project API should be consulted to find out
   */
  sampleIssueId?: string;
};

function WaitingForEvents({org, project, sampleIssueId: sampleIssueIdProp}: Props) {
  const {data, error, isPending} = useQuery(
    apiOptions.as<Array<{id: string}>>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/issues/',
      {
        staleTime: Infinity,
        data: {limit: 1},
        path:
          project && sampleIssueIdProp === undefined
            ? {
                organizationIdOrSlug: org.slug,
                projectIdOrSlug: project.slug,
              }
            : skipToken,
      }
    )
  );

  const sampleIssueId = sampleIssueIdProp ?? data?.[0]?.id ?? '';

  const sampleLink =
    project && (isPending || error ? null : sampleIssueId) ? (
      <Link to={`/${org.slug}/${project.slug}/issues/${sampleIssueId}/?sample`}>
        {t('Or see your sample event')}
      </Link>
    ) : (
      <CreateSampleEventButton
        variant="link"
        project={project}
        source="issues_list"
        disabled={!project}
        tooltipProps={{
          title: project ? undefined : t('Select a project to create a sample event'),
        }}
      >
        {t('Create a sample event')}
      </CreateSampleEventButton>
    );

  return (
    <EmptyState
      data-test-id="awaiting-events"
      padding="3xl"
      align="center"
      justify="center"
      title={t('Waiting for events…')}
      description={t('Your code sleuth eagerly awaits its first mission.')}
      illustration={
        <Image
          width="auto"
          height={{zero: '150px', lg: '185px'}}
          loading="eager"
          src={waitingForEventImg}
          alt={t('Illustration of a detective waiting for events')}
        />
      }
      action={
        <Fragment>
          {project && (
            <LinkButton
              data-test-id="install-instructions"
              variant="primary"
              to={makeProjectsPathname({
                path: `/${project.slug}/getting-started/`,
                organization: org,
              })}
            >
              {t('Installation Instructions')}
            </LinkButton>
          )}
          {sampleLink}
        </Fragment>
      }
    />
  );
}

export default WaitingForEvents;
