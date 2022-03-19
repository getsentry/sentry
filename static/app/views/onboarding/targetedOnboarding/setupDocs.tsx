import {useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import * as qs from 'query-string';

import {loadDocs} from 'sentry/actionCreators/projects';
import Alert, {alertStyles} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import {PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import {Theme} from 'sentry/utils/theme';
import useApi from 'sentry/utils/useApi';
import withProjects from 'sentry/utils/withProjects';
import FullIntroduction from 'sentry/views/onboarding/components/fullIntroduction';

import FirstEventFooter from './components/firstEventFooter';
import TargetedOnboardingSidebar from './components/sidebar';
import {StepProps} from './types';

/**
 * The documentation will include the following string should it be missing the
 * verification example, which currently a lot of docs are.
 */
const INCOMPLETE_DOC_FLAG = 'TODO-ADD-VERIFICATION-EXAMPLE';

type PlatformDoc = {html: string; link: string};

type Props = {
  projects: Project[];
  search: string;
  // subStep: 'project' | 'integration';
} & StepProps;

function SetupDocs({organization, projects, search}: Props) {
  const api = useApi();
  const [hasError, setHasError] = useState(false);
  const [platformDocs, setPlatformDocs] = useState<PlatformDoc | null>(null);
  const [loadedPlatform, setLoadedPlatform] = useState<PlatformKey | null>(null);

  // TODO: Check no projects
  const {sub_step: rawSubStep, project_id: rawProjectId} = qs.parse(search);
  const subStep = rawSubStep === 'integration' ? 'integration' : 'project';
  const rawProjectIndex = projects.findIndex(p => p.id === rawProjectId);
  const projectIndex = rawProjectIndex >= 0 ? rawProjectIndex : 0;
  const project = projects[projectIndex];
  const {platform} = project || {};
  const currentPlatform = loadedPlatform ?? platform ?? 'other';

  const fetchData = async () => {
    // const {platform} = project || {};
    // TODO: add better error handling logic
    setPlatformDocs(null);
    if (!project?.platform) {
      return;
    }
    try {
      const loadedDocs = await loadDocs(
        api,
        organization.slug,
        project.slug,
        project.platform
      );
      setPlatformDocs(loadedDocs);
      setLoadedPlatform(project.platform);
      setHasError(false);
    } catch (error) {
      setHasError(error);
      throw error;
    }
  };

  useEffect(() => {
    fetchData();
  }, [project]);

  // TODO: add better error handling logic
  if (!project && subStep === 'project') {
    return null;
  }

  const setNewProject = (newProjectId: string) => {
    const searchParams = new URLSearchParams({
      project_id: newProjectId,
    });
    browserHistory.push(`${window.location.pathname}?${searchParams}`);
  };

  const missingExampleWarning = () => {
    const missingExample =
      platformDocs && platformDocs.html.includes(INCOMPLETE_DOC_FLAG);

    if (!missingExample) {
      return null;
    }

    return (
      <Alert type="warning" icon={<IconInfo size="md" />}>
        {tct(
          `Looks like this getting started example is still undergoing some
           work and doesn't include an example for triggering an event quite
           yet. If you have trouble sending your first event be sure to consult
           the [docsLink:full documentation] for [platform].`,
          {
            docsLink: <ExternalLink href={platformDocs?.link} />,
            platform: platforms.find(p => p.id === loadedPlatform)?.name,
          }
        )}
      </Alert>
    );
  };

  const docs = platformDocs !== null && (
    <DocsWrapper key={platformDocs.html}>
      <Content dangerouslySetInnerHTML={{__html: platformDocs.html}} />
      {missingExampleWarning()}
      {project && (
        <FirstEventFooter
          project={project}
          organization={organization}
          onClickSetupLater={() => {
            // TODO: analytics
            if (projectIndex >= projects.length - 1) {
              // TODO: integratioins
              browserHistory.push('/');
              return;
            }
            setNewProject(projects[projectIndex + 1].id);
          }}
        />
      )}
    </DocsWrapper>
  );

  const loadingError = (
    <LoadingError
      message={t('Failed to load documentation for the %s platform.', platform)}
      onRetry={fetchData}
    />
  );

  const testOnlyAlert = (
    <Alert type="warning">
      Platform documentation is not rendered in for tests in CI
    </Alert>
  );

  return (
    <Wrapper>
      <TargetedOnboardingSidebar activeProject={project} setNewProject={setNewProject} />
      <div>
        <FullIntroduction currentPlatform={currentPlatform} />
        {getDynamicText({
          value: !hasError ? docs : loadingError,
          fixed: testOnlyAlert,
        })}
      </div>
    </Wrapper>
  );
}

export default withProjects(SetupDocs);

type AlertType = React.ComponentProps<typeof Alert>['type'];

const getAlertSelector = (type: AlertType) =>
  type === 'muted' ? null : `.alert[level="${type}"], .alert-${type}`;

const mapAlertStyles = (p: {theme: Theme}, type: AlertType) =>
  css`
    ${getAlertSelector(type)} {
      ${alertStyles({theme: p.theme, type})};
      display: block;
    }
  `;

const Content = styled(motion.div)`
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p {
    margin-bottom: 18px;
  }

  div[data-language] {
    margin-bottom: ${space(2)};
  }

  code {
    font-size: 87.5%;
    color: ${p => p.theme.pink300};
  }

  pre code {
    color: inherit;
    font-size: inherit;
    white-space: pre;
  }

  h2 {
    font-size: 1.4em;
  }

  .alert h5 {
    font-size: 1em;
    margin-bottom: 0.625rem;
  }

  /**
   * XXX(epurkhiser): This comes from the doc styles and avoids bottom margin issues in alerts
   */
  .content-flush-bottom *:last-child {
    margin-bottom: 0;
  }

  ${p => Object.keys(p.theme.alert).map(type => mapAlertStyles(p, type as AlertType))}
`;

const DocsWrapper = styled(motion.div)``;

DocsWrapper.defaultProps = {
  initial: {opacity: 0, y: 40},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0},
};

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr fit-content(100%) 1fr;
  width: max-content;
`;
