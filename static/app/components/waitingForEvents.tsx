import styled from '@emotion/styled';
import {skipToken, useQuery} from '@tanstack/react-query';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import {LinkButton} from '@sentry/scraps/button';
import {Link} from '@sentry/scraps/link';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import CreateSampleEventButton from 'sentry/views/onboarding/createSampleEventButton';
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
      <p>
        <Link to={`/${org.slug}/${project.slug}/issues/${sampleIssueId}/?sample`}>
          {t('Or see your sample event')}
        </Link>
      </p>
    ) : (
      <p>
        <CreateSampleEventButton
          priority="link"
          project={project}
          source="issues_list"
          disabled={!project}
          tooltipProps={{
            title: project ? undefined : t('Select a project to create a sample event'),
          }}
        >
          {t('Create a sample event')}
        </CreateSampleEventButton>
      </p>
    );

  return (
    <Wrapper data-test-id="awaiting-events" className="awaiting-events">
      <img
        src={waitingForEventImg}
        alt="No errors found spot illustration"
        height={200}
      />
      <MessageContainer>
        <h3>{t('Waiting for events…')}</h3>
        <p>{t('Your code sleuth eagerly awaits its first mission.')}</p>
        <p>
          {project && (
            <LinkButton
              data-test-id="install-instructions"
              priority="primary"
              to={makeProjectsPathname({
                path: `/${project.slug}/getting-started/`,
                organization: org,
              })}
            >
              {t('Installation Instructions')}
            </LinkButton>
          )}
        </p>
        {sampleLink}
      </MessageContainer>
    </Wrapper>
  );
}

export default WaitingForEvents;

const Wrapper = styled('div')`
  display: flex;
  justify-content: center;
  font-size: ${p => p.theme.font.size.lg};
  border-radius: 0 0 3px 3px;
  padding: 40px ${space(3)};
  min-height: 260px;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    flex-direction: column;
    align-items: center;
    padding: ${space(3)};
    text-align: center;
  }
`;

const MessageContainer = styled('div')`
  align-self: center;
  max-width: 480px;
  margin-left: 40px;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    margin: 0;
  }
`;
