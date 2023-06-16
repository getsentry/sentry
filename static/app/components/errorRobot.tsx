import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import robotBackground from 'sentry-images/spot/sentry-robot.png';

import {Button} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
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

function ErrorRobot({org, project, sampleIssueId: sampleIssueIdProp}: Props) {
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
    <ErrorRobotWrapper data-test-id="awaiting-events" className="awaiting-events">
      <Robot aria-hidden>
        <Eye />
      </Robot>
      <MessageContainer>
        <h3>{t('Waiting for events…')}</h3>
        <p>
          {tct(
            'Our error robot is waiting to [strike:devour] receive your first event.',
            {
              strike: <Strikethrough />,
            }
          )}
        </p>
        <p>
          {project && (
            <Button
              data-test-id="install-instructions"
              priority="primary"
              to={`/${org.slug}/${project.slug}/getting-started/${
                project.platform || ''
              }`}
            >
              {t('Installation Instructions')}
            </Button>
          )}
        </p>
        {sampleLink}
      </MessageContainer>
    </ErrorRobotWrapper>
  );
}

export default ErrorRobot;

const ErrorRobotWrapper = styled('div')`
  display: flex;
  justify-content: center;
  font-size: ${p => p.theme.fontSizeLarge};
  border-radius: 0 0 3px 3px;
  padding: 40px ${space(3)} ${space(3)};
  min-height: 260px;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
    align-items: center;
    padding: ${space(3)};
    text-align: center;
  }
`;

const Robot = styled('div')`
  display: block;
  position: relative;
  width: 220px;
  height: 260px;
  background: url(${robotBackground});
  background-size: cover;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    width: 110px;
    height: 130px;
  }
`;

const Eye = styled('span')`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  position: absolute;
  top: 70px;
  left: 81px;
  transform: translateZ(0);
  animation: blink-eye 0.6s infinite;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    width: 6px;
    height: 6px;
    top: 35px;
    left: 41px;
  }

  @keyframes blink-eye {
    0% {
      background: #e03e2f;
      box-shadow: 0 0 10px #e03e2f;
    }

    50% {
      background: #4a4d67;
      box-shadow: none;
    }

    100% {
      background: #e03e2f;
      box-shadow: 0 0 10px #e03e2f;
    }
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

const Strikethrough = styled('span')`
  text-decoration: line-through;
`;
