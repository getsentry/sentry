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
  importInst?: string;
  importInstCode?: string;
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
    installCode: 'npm install --save @sentry/node @sentry/profiling-node',
    configure: t(
      "Initialize Sentry as early as possible in your application's lifecycle. To initialize the SDK before everything else, create an external file called `instrument.js/mjs`."
    ),
    configureCode:
      dsn => `// Import with 'import * as Sentry from "@sentry/node"' if you are using ESM
const Sentry = require("@sentry/node");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

Sentry.init({
  dsn: "${dsn}",
  integrations: [
    nodeProfilingIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions

  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});`,
    importInst: t(
      'You need to require or import the instrument.js file before requiring any other modules in your application'
    ),
    importInstCode: `// IMPORTANT: Make sure to import 'instrument.js' at the top of your file.
// If you're using ECMAScript Modules (ESM) syntax, use 'import "./instrument.js";'
require("./instrument.js");

// All other imports below
const { createServer } = require("node:http");

const server = createServer((req, res) => {
  // server code
});

server.listen(3000, "127.0.0.1");`,
    sourcemaps: t(
      'Automatically upload your source maps to enable readable stack traces for Errors.'
    ),
    sourcemapsCode: 'npx @sentry/wizard@latest -i sourcemaps',
    verify: t(
      'Add this intentional error to your application to test that everything is working right away.'
    ),
    verifyCode: `Sentry.startSpan({
      op: "test",
      name: "My First Test Span",
}, () => {
  try {
    foo();
  } catch (e) {
    Sentry.captureException(e);
  }
});`,
  },
  'python-django': {
    install: t('Use the following command to install our Python Django SDK'),
    installCode: "pip install --upgrade 'sentry-sdk[django]'",
    configure: t('To configure the Sentry SDK, initialize it in your settings.py file:'),
    configureCode: dsn => `import sentry_sdk

sentry_sdk.init(
  dsn="${dsn}",
  # Set traces_sample_rate to 1.0 to capture 100%
  # of transactions for performance monitoring.
  traces_sample_rate=1.0,
  # Set profiles_sample_rate to 1.0 to profile 100%
  # of sampled transactions.
  # We recommend adjusting this value in production.
  profiles_sample_rate=1.0,
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
    importInst,
    verify,
    installCode,
    configureCode,
    importInstCode,
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
            {importInst ? (
              <GuidedSteps.Step
                stepKey="import-inst-sentry"
                title={t('Import Instrumentation')}
              >
                <div>
                  <div>
                    {importInst}
                    {importInstCode && (
                      <StyledCodeSnippet language={language}>
                        {importInstCode}
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
          <ArcadeWrapper>
            <Arcade
              src="https://demo.arcade.software/54VidzNthU5ykIFPCdW1?embed"
              loading="lazy"
              allowFullScreen
            />
          </ArcadeWrapper>
        </Preview>
      </Body>
    </div>
  );
}

const Title = styled('div')`
  font-size: 26px;
  font-weight: ${p => p.theme.fontWeightBold};
`;

const Description = styled('div')`
  max-width: 340px;
`;

const ArcadeWrapper = styled('div')`
  margin-top: ${space(1)};
`;

const HeaderWrapper = styled('div')`
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(4)};
`;

const BodyTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
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

const Arcade = styled('iframe')`
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
