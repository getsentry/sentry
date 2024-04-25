import {Fragment} from 'react';
import styled from '@emotion/styled';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import ButtonBar from 'sentry/components/buttonBar';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformKey, Project, ProjectKey} from 'sentry/types';
import {defined} from 'sentry/utils';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import FirstEventIndicator from 'sentry/views/onboarding/components/firstEventIndicator';

type GuidedStepInfo = {
  install: string;
  installCode: string;
  configure?: string;
  configureCode?: (dsn: string) => string;
  sourcemaps?: string;
  sourcemapsCode?: string;
  verify?: string;
  verifyCode?: string;
};

const GuidedStepsMap: Partial<Record<PlatformKey, GuidedStepInfo>> = {
  'javascript-nextjs': {
    install: t(
      'Add Sentry automiatcally to your app with the Sentry Wizard (call this inside your project directory)'
    ),
    installCode: 'npx @sentry/wizard@latest -i nextjs',
  },
  node: {
    install: t('Add the Sentry Node SDK as a dependency'),
    installCode: 'npm install --save @sentry/node',
    configure: t(
      "Initialize Sentry as early as possible in your application's lifecycle"
    ),
    configureCode:
      dsn => `// You can also use ESM 'import * as Sentry from "@sentry/node"' instead of 'require'
const Sentry = require("@sentry/node");

Sentry.init({
  dsn: "${dsn}",
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
});`,
    sourcemaps: t(
      'Automatically upload your source maps to enable readable stack traces for Errors.'
    ),
    sourcemapsCode: 'npx @sentry/wizard@latest -i sourcemaps',
    verify: t(
      'Add this intentional error to your application to test that everything is working right away.'
    ),
    verifyCode: `const transaction = Sentry.startTransaction({
      op: "test",
      name: "My First Test Transaction",
});

setTimeout(() => {
  try {
    foo();
  } catch (e) {
    Sentry.captureException(e);
  } finally {
    transaction.finish();
  }
}, 99);`,
  },
  'python-django': {
    install: t('Use the following command to install our Python Django SDK'),
    installCode: "pip install --upgrade 'sentry-sdk[django]'",
    configure: t(
      'If you have the Django package in your dependencies, the Django integration will be enabled automatically when you initialize the Sentry SDK. Initialize the Sentry SDK in your Django settings.py file'
    ),
    configureCode: dsn => `# settings.py
import sentry_sdk

sentry_sdk.init(
  dsn="${dsn}",
  enable_tracing=True
)`,
    verify: t(
      'Add this intentional error to your application to test that everything is working right away.'
    ),
    verifyCode: `# urls.py
from django.urls import path

def trigger_error(request):
    division_by_zero = 1 / 0

urlpatterns = [
    path('sentry-debug/', trigger_error),
    # ...
]`,
  },
  android: {
    install: t(
      'Add Sentry automiatcally to your app with the Sentry Wizard (call this inside your project directory)'
    ),
    installCode: 'brew install getsentry/tools/sentry-wizard && sentry-wizard -i android',
  },
};

export default function UpdatedEmptyState({project}: {project?: Project}) {
  const organization = useOrganization();
  const platformGuidedSteps = project?.platform ? GuidedStepsMap[project.platform] : null;

  const {
    data: projectKeys,
    isError: projectKeysIsError,
    isLoading: projectKeysIsLoading,
  } = useApiQuery<ProjectKey[]>(
    [`/projects/${organization.slug}/${project?.slug}/keys/`],
    {
      staleTime: Infinity,
      enabled: defined(project),
    }
  );

  if (
    !platformGuidedSteps ||
    !project ||
    projectKeysIsError ||
    projectKeysIsLoading ||
    !projectKeys ||
    projectKeys.length === 0
  ) {
    return null;
  }

  const dsn = projectKeys[0].dsn.public;
  const language = project?.platform === 'node' ? 'javascript' : 'python';

  const {
    install,
    configure,
    verify,
    installCode,
    configureCode,
    verifyCode,
    sourcemaps,
    sourcemapsCode,
  } = platformGuidedSteps;
  return (
    <div>
      <HeaderWrapper>
        <Title>{t('Get Started with Sentry Issues')}</Title>
        <Description>
          {t('Your code sleuth eagerly awaits its first mission.')}
        </Description>
        <Image src={waitingForEventImg} />
      </HeaderWrapper>
      <Divider />
      <Body>
        <Setup>
          <BodyTitle>{t('Set up the Sentry SDK')}</BodyTitle>
          <GuidedSteps>
            <GuidedSteps.Step stepKey="install-sentry" title={t('Install Sentry')}>
              <div>
                <div>
                  {install}
                  <StyledCodeSnippet>{installCode}</StyledCodeSnippet>
                  {!verify && (
                    <FirstEventIndicator
                      organization={organization}
                      project={project}
                      eventType="error"
                    >
                      {({indicator, firstEventButton}) => (
                        <div>
                          <IndicatorWrapper>{indicator}</IndicatorWrapper>
                          <StyledButtonBar gap={1}>
                            <GuidedSteps.BackButton size="md" />
                            {firstEventButton}
                          </StyledButtonBar>
                        </div>
                      )}
                    </FirstEventIndicator>
                  )}
                </div>
                <GuidedSteps.ButtonWrapper>
                  <GuidedSteps.BackButton size="md" />
                  <GuidedSteps.NextButton size="md" />
                </GuidedSteps.ButtonWrapper>
              </div>
            </GuidedSteps.Step>
            {configure ? (
              <GuidedSteps.Step stepKey="configure-sentry" title={t('Configure Sentry')}>
                <div>
                  <div>
                    {configure}
                    {configureCode && (
                      <StyledCodeSnippet language={language}>
                        {configureCode(dsn)}
                      </StyledCodeSnippet>
                    )}
                  </div>
                  <GuidedSteps.ButtonWrapper>
                    <GuidedSteps.BackButton size="md" />
                    <GuidedSteps.NextButton size="md" />
                  </GuidedSteps.ButtonWrapper>
                </div>
              </GuidedSteps.Step>
            ) : (
              <Fragment />
            )}
            {sourcemaps ? (
              <GuidedSteps.Step stepKey="sourcemaps" title={t('Upload Source Maps')}>
                <div>
                  <div>
                    {sourcemaps}
                    {sourcemapsCode && (
                      <StyledCodeSnippet language={language}>
                        {sourcemapsCode}
                      </StyledCodeSnippet>
                    )}
                  </div>
                  <GuidedSteps.ButtonWrapper>
                    <GuidedSteps.BackButton size="md" />
                    <GuidedSteps.NextButton size="md" />
                  </GuidedSteps.ButtonWrapper>
                </div>
              </GuidedSteps.Step>
            ) : (
              <Fragment />
            )}
            {verify ? (
              <GuidedSteps.Step stepKey="verify" title={t('Verify')}>
                <div>
                  {verify}
                  {verifyCode && (
                    <StyledCodeSnippet language={language}>
                      {verifyCode}
                    </StyledCodeSnippet>
                  )}
                  <FirstEventIndicator
                    organization={organization}
                    project={project}
                    eventType="error"
                  >
                    {({indicator, firstEventButton}) => (
                      <div>
                        <IndicatorWrapper>{indicator}</IndicatorWrapper>
                        <StyledButtonBar gap={1}>
                          <GuidedSteps.BackButton size="md" />
                          {firstEventButton}
                        </StyledButtonBar>
                      </div>
                    )}
                  </FirstEventIndicator>
                </div>
              </GuidedSteps.Step>
            ) : (
              <Fragment />
            )}
          </GuidedSteps>
        </Setup>
        <Preview>
          <BodyTitle>{t('Preview a Sentry Issue')}</BodyTitle>
          <VideoWrapper>
            <Video
              src="https://s3.us-east-1.amazonaws.com/remotionlambda-production/renders/x87ndylphr/out.mp4?v=415e1797fdba69d917459d119dc6c5af"
              loading="lazy"
              allowFullScreen
            />
          </VideoWrapper>
        </Preview>
      </Body>
    </div>
  );
}

const Title = styled('div')`
  font-size: 26px;
  font-weight: 600;
`;

const Description = styled('div')`
  max-width: 340px;
`;

const VideoWrapper = styled('div')`
  margin-top: ${space(1)};
`;

const HeaderWrapper = styled('div')`
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(4)};
`;

const BodyTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: 600;
  margin-bottom: ${space(1)};
`;

const Setup = styled('div')`
  padding: ${space(4)};

  &:after {
    content: '';
    position: absolute;
    right: 50%;
    top: 19%;
    height: 78%;
    border-right: 1px ${p => p.theme.border} solid;
  }
`;

const Preview = styled('div')`
  padding: ${space(4)};
`;

const Body = styled('div')`
  display: grid;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;

  h4 {
    margin-bottom: 0;
  }
`;

const Image = styled('img')`
  position: absolute;
  display: block;
  top: 0px;
  right: 20px;
  pointer-events: none;
  height: 120px;
  overflow: hidden;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const Divider = styled('hr')`
  height: 1px;
  width: 95%;
  background: ${p => p.theme.border};
  border: none;
  margin-top: 0;
  margin-bottom: 0;
`;

const Video = styled('iframe')`
  width: 750px;
  max-width: 100%;
  height: 500px;
  border: 0;
`;

const StyledButtonBar = styled(ButtonBar)`
  display: flex;
`;

const IndicatorWrapper = styled('div')`
  width: 300px;
  max-width: 100%;
  margin-bottom: ${space(1)};
`;

const StyledCodeSnippet = styled(CodeSnippet)`
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
`;
