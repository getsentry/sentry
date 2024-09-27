import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import {LinkButton} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';
import CreateSampleEventButton from 'sentry/views/onboarding/createSampleEventButton';

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
  const api = useApi();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<boolean | string>(false);
  const [sampleIssueId, setSampleIssueId] = useState(sampleIssueIdProp);

  useEffect(() => {
    async function loadSampleData() {
      if (!project) {
        return;
      }

      if (sampleIssueIdProp !== undefined) {
        return;
      }

      setLoading(true);

      try {
        const data = await api.requestPromise(
          `/projects/${org.slug}/${project.slug}/issues/`,
          {
            method: 'GET',
            data: {limit: 1},
          }
        );
        setSampleIssueId((data.length > 0 && data[0].id) || '');
      } catch (err) {
        setError(err?.responseJSON?.detail ?? true);
      }
    }

    loadSampleData();
  }, [api, org, project, sampleIssueIdProp]);

  const sampleLink =
    project && (loading || error ? null : sampleIssueId) ? (
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
          title={!project ? t('Select a project to create a sample event') : undefined}
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
              to={`/${org.slug}/${project.slug}/getting-started/${
                project.platform || ''
              }`}
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
  font-size: ${p => p.theme.fontSizeLarge};
  border-radius: 0 0 3px 3px;
  padding: 40px ${space(3)};
  min-height: 260px;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
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

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin: 0;
  }
`;
