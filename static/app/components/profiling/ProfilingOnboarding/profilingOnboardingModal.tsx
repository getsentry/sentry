import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {PlatformIcon} from 'platformicons';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Button, {ButtonPropsWithoutAriaLabel} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {SelectField} from 'sentry/components/forms';
import {SelectFieldProps} from 'sentry/components/forms/fields/selectField';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import List from 'sentry/components/list';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Tag from 'sentry/components/tag';
import {IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, UpdateSdkSuggestion} from 'sentry/types';
import {RequestState} from 'sentry/types/core';
import {Project, ProjectSdkUpdates} from 'sentry/types/project';
import {semverCompare} from 'sentry/utils/profiling/units/versions';
import {useProjectKeys} from 'sentry/utils/useProjectKeys';
import useProjects from 'sentry/utils/useProjects';
import {useProjectSdkUpdates} from 'sentry/utils/useProjectSdkUpdates';

// This is just a doubly linked list of steps
interface OnboardingStep {
  current: React.ComponentType<OnboardingStepProps>;
  next: OnboardingStep | null;
  previous: OnboardingStep | null;
}

type OnboardingRouterState = [OnboardingStep, (step: OnboardingStep | null) => void];
function useOnboardingRouter(initialStep: OnboardingStep): OnboardingRouterState {
  const [state, setState] = useState(initialStep);

  const toStep = useCallback((nextStep: OnboardingStep | null) => {
    // For ergonomics, else we need to move everything to consts so that typescript can infer non nullable types
    if (nextStep === null) {
      return;
    }

    setState(current => {
      const next = {...nextStep, next: null, previous: current};
      // Add the edges between the old and the new step
      current.next = next;
      next.previous = current;
      // Return the next step
      return next;
    });
  }, []);

  return [state, toStep];
}

// The wrapper component for all of the onboarding steps. Keeps track of the current step
// and all state. This ensures that moving from step to step does not require users to redo their actions
// and each step can just re-initialize with the values that the user has already selected.

interface ProfilingOnboardingModalProps extends ModalRenderProps {
  organization: Organization;
}
export function ProfilingOnboardingModal(props: ProfilingOnboardingModalProps) {
  const [state, toStep] = useOnboardingRouter({
    previous: null,
    current: SelectProjectStep,
    next: null,
  });
  const [project, setProject] = useState<Project | null>(null);

  return (
    <state.current
      {...props}
      toStep={toStep}
      step={state}
      project={project}
      setProject={setProject}
    />
  );
}

// Generate an option for the select field from project
function asSelectOption(
  project: Project,
  options: {disabled: boolean}
): SelectFieldProps<Project>['options'][0]['options'] {
  return {
    label: project.slug,
    value: project,
    disabled: options.disabled,
    leadingItems: project.platform ? <PlatformIcon platform={project.platform} /> : null,
  };
}

const platformToInstructionsMapping: Record<
  string,
  React.ComponentType<OnboardingStepProps>
> = {
  android: AndroidSendDebugFilesInstruction,
  'apple-ios': IOSSendDebugFilesInstruction,
};

// Splits a list of projects into supported and unsuported list
function splitProjectsByProfilingSupport(projects: Project[]): {
  supported: Project[];
  unsupported: Project[];
} {
  const supported: Project[] = [];
  const unsupported: Project[] = [];

  for (const project of projects) {
    if (project.platform && platformToInstructionsMapping[project.platform]) {
      supported.push(project);
    } else {
      unsupported.push(project);
    }
  }

  return {supported, unsupported};
}

// Individual modal steps are defined here.
// We proxy the modal props to each individaul modal component
// so that each can build their own modal and they can remain independent.
interface OnboardingStepProps extends ModalRenderProps {
  organization: Organization;
  project: Project | null;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  step: OnboardingStep;
  toStep: OnboardingRouterState[1];
}

function SelectProjectStep({
  Body: ModalBody,
  Header: ModalHeader,
  Footer: ModalFooter,
  closeModal,
  toStep,
  step,
  project,
  setProject,
  organization,
}: OnboardingStepProps) {
  const {projects} = useProjects();

  const onFormSubmit = useCallback(
    (evt: React.FormEvent) => {
      evt.preventDefault();

      if (!project?.platform) {
        return;
      }

      const nextStep = platformToInstructionsMapping[project.platform];
      if (nextStep === undefined) {
        throw new TypeError(
          "Platform doesn't have a onboarding step, user should not be able to select it"
        );
      }

      toStep({
        previous: step,
        current: nextStep,
        next: null,
      });
    },
    [project, step, toStep]
  );

  const projectSelectOptions = useMemo((): SelectFieldProps<Project>['options'] => {
    const {supported: supportedProjects, unsupported: unsupporedProjects} =
      splitProjectsByProfilingSupport(projects);

    return [
      {
        label: t('Supported'),
        options: supportedProjects.map(p => asSelectOption(p, {disabled: false})),
      },
      {
        label: t('Unsupported'),
        options: unsupporedProjects.map(p => asSelectOption(p, {disabled: true})),
      },
    ];
  }, [projects]);

  const sdkUpdates = useProjectSdkUpdates({organization, projectId: project?.id ?? null});

  const publicDSN = usePublicDSN({organization, project});

  return (
    <ModalBody>
      <ModalHeader>
        <h3>{t('Set Up Profiling')}</h3>
      </ModalHeader>
      <form onSubmit={onFormSubmit}>
        <StyledList symbol="colored-numeric">
          <li>
            <StepTitle>
              <label htmlFor="project-select">{t('Select a project')}</label>
            </StepTitle>
            <div>
              <StyledSelectField
                id="project-select"
                name="select"
                options={projectSelectOptions}
                onChange={setProject}
              />
            </div>
          </li>
          {project?.platform === 'android' ? (
            <AndroidInstallSteps
              sdkUpdates={sdkUpdates}
              project={project}
              organization={organization}
              publicDSN={publicDSN}
            />
          ) : null}
          {project?.platform === 'apple-ios' ? (
            <IOSInstallSteps
              sdkUpdates={sdkUpdates}
              project={project}
              organization={organization}
              publicDSN={publicDSN}
            />
          ) : null}
        </StyledList>
        <ModalFooter>
          <ModalActions>
            <DocsLink />
            <div>
              <StepIndicator>{t('Step 1 of 2')}</StepIndicator>
              <PreviousStepButton type="button" onClick={closeModal} />
              <NextStepButton
                disabled={
                  !(
                    project?.platform && platformToInstructionsMapping[project.platform]
                  ) || publicDSN.type === 'loading'
                }
                type="submit"
              />
            </div>
          </ModalActions>
        </ModalFooter>
      </form>
    </ModalBody>
  );
}

function usePublicDSN({
  organization,
  project,
}: {
  organization: Organization | null;
  project: Project | null;
}) {
  const response = useProjectKeys({organization, project});
  if (response.type !== 'resolved') {
    return response;
  }

  const dsn = response.data?.[0]?.dsn.public;
  if (!dsn) {
    Sentry.captureException(
      new Error(`public dsn not found for ${organization?.slug}/${project?.slug}`)
    );
  }
  return {
    ...response,
    data: dsn,
  };
}

function SetupPerformanceMonitoringStep({href}: {href: string}) {
  return (
    <Fragment>
      <StepTitle>{t('Setup Performance Monitoring')}</StepTitle>
      {tct(
        `For Profiling to function, it's required to set up Performance monitoring. Follow the [setupDocs]`,
        {
          setupDocs: (
            <ExternalLink openInNewTab href={href}>
              {t('step-by-step instructions here.')}
            </ExternalLink>
          ),
        }
      )}
    </Fragment>
  );
}

interface ProjectSdkUpdateProps {
  minSdkVersion: string;
  organization: Organization;
  project: Project;
  sdkUpdates: ProjectSdkUpdates;
}

function ProjectSdkUpdate({
  sdkUpdates,
  organization,
  project,
  minSdkVersion,
}: ProjectSdkUpdateProps) {
  const updateSdkSuggestion = sdkUpdates.suggestions.find(v => v.type === 'updateSdk') as
    | UpdateSdkSuggestion
    | undefined;

  return (
    <Fragment>
      <SDKUpdatesContainer>
        <SdkUpdatesPlatformIcon platform={project.platform ?? 'unknown'} />
        <Link
          to={`/organizations/${organization.slug}/projects/${project.slug}/?project=${project.id}`}
        >
          {project.slug}
        </Link>
      </SDKUpdatesContainer>

      <SdkUpdatesText>
        {t('This project is on %s@%s', sdkUpdates.sdkName, sdkUpdates.sdkVersion)}
        <br />
        {updateSdkSuggestion ? (
          <Link to={updateSdkSuggestion.sdkUrl ?? ''}>
            {t(
              'Update to %s@%s',
              updateSdkSuggestion.sdkName,
              updateSdkSuggestion.newSdkVersion
            )}
          </Link>
        ) : (
          t('Update to %s or higher', minSdkVersion)
        )}
      </SdkUpdatesText>
    </Fragment>
  );
}

const SdkUpdatesText = styled('p')`
  margin-top: ${space(0.75)};
  padding-left: ${space(4)};
`;

// doesnt use space because it's just off by 2px all the time
const SdkUpdatesPlatformIcon = styled(PlatformIcon)`
  margin-right: 10px;
`;

const SDKUpdatesContainer = styled('div')`
  display: flex;
  align-items: center;
  margin-top: ${space(1.5)};
  font-size: ${p => p.theme.fontSizeLarge};
`;

interface InstallStepsProps {
  organization: Organization;
  project: Project;
  publicDSN: RequestState<string | null>;
  sdkUpdates: RequestState<ProjectSdkUpdates | null>;
}

function AndroidInstallSteps({
  project,
  sdkUpdates,
  organization,
  publicDSN,
}: InstallStepsProps) {
  const hasSdkUpdates = sdkUpdates.type === 'resolved' && sdkUpdates.data !== null;
  const requiresSdkUpdates =
    hasSdkUpdates &&
    sdkUpdates.data?.sdkVersion &&
    // ensure we only prompt an upgrade when the sdk is one of the following
    ['sentry.java.android', 'sentry.java.android.timber'].includes(
      sdkUpdates.data.sdkName
    )
      ? semverCompare(sdkUpdates.data.sdkVersion, '6.0.0') < 0
      : false;

  const dsn =
    publicDSN.type === 'resolved' && publicDSN.data !== null ? publicDSN.data : '...';
  return (
    <Fragment>
      {hasSdkUpdates && requiresSdkUpdates && (
        <li>
          <StepTitle>{t('Update your projects SDK version')}</StepTitle>
          <ProjectSdkUpdate
            minSdkVersion="6.0.0 (sentry.android)"
            project={project}
            sdkUpdates={sdkUpdates.data!}
            organization={organization}
          />
        </li>
      )}
      <li>
        <SetupPerformanceMonitoringStep href="https://docs.sentry.io/platforms/android/performance/" />
      </li>
      <li>
        <StepTitle>{t('Set Up Profiling')}</StepTitle>
        {publicDSN.type === 'loading' ? (
          <LoadingIndicator />
        ) : (
          <CodeSnippet language="xml" filename="AndroidManifest.xml">
            {`<application>
  <meta-data android:name="io.sentry.dsn" android:value="${dsn}" />
  <meta-data android:name="io.sentry.traces.sample-rate" android:value="1.0" />
  <meta-data android:name="io.sentry.traces.profiling.sample-rate" android:value="1.0" />
</application>`}
          </CodeSnippet>
        )}
      </li>
    </Fragment>
  );
}

function IOSInstallSteps({
  project,
  sdkUpdates,
  organization,
  publicDSN,
}: InstallStepsProps) {
  const hasSdkUpdates = sdkUpdates.type === 'resolved' && sdkUpdates.data !== null;
  const requiresSdkUpdates =
    hasSdkUpdates &&
    sdkUpdates.data?.sdkVersion &&
    sdkUpdates.data?.sdkName === 'sentry.cocoa'
      ? semverCompare(sdkUpdates.data.sdkVersion, '7.23.0') < 0
      : false;

  const dsn = publicDSN.type === 'resolved' && publicDSN.data ? publicDSN.data : '...';
  return (
    <Fragment>
      {hasSdkUpdates && requiresSdkUpdates && (
        <li>
          <StepTitle>{t('Update your projects SDK version')}</StepTitle>
          <ProjectSdkUpdate
            minSdkVersion="7.23.0 (sentry.cocoa)"
            project={project}
            sdkUpdates={sdkUpdates.data!}
            organization={organization}
          />
        </li>
      )}
      <li>
        <SetupPerformanceMonitoringStep href="https://docs.sentry.io/platforms/apple/guides/ios/performance/" />
      </li>
      <li>
        <StepTitle>
          {t('Enable profiling in your app by configuring the SDKs like below:')}
        </StepTitle>

        {publicDSN.type === 'loading' ? (
          <LoadingIndicator />
        ) : (
          <CodeSnippet language="swift">
            {`SentrySDK.start { options in
  options.dsn = "${dsn}"
  options.tracesSampleRate = 1.0 // Make sure transactions are enabled
  options.profilesSampleRate = 1.0
}`}
          </CodeSnippet>
        )}
      </li>
    </Fragment>
  );
}

const StyledList = styled(List)`
  position: relative;

  li {
    margin-bottom: ${space(3)};
  }
`;

const StyledSelectField = styled(SelectField)`
  padding: 0;
  border-bottom: 0;

  > div {
    width: 100%;
    padding-left: 0;
  }
`;

function AndroidSendDebugFilesInstruction({
  Body: ModalBody,
  Header: ModalHeader,
  Footer: ModalFooter,
  closeModal,
  toStep,
  step,
}: OnboardingStepProps) {
  return (
    <ModalBody>
      <ModalHeader>
        <h3>{t('Set Up Profiling')}</h3>
      </ModalHeader>
      <p>
        {t(
          `If you want to see de-obfuscated stack traces, you'll need to use ProGuard with Sentry. To do so, upload the ProGuard mapping files by either the recommended method of using our Gradle integration or manually by using sentry-cli.`
        )}{' '}
        <ExternalLink href="https://docs.sentry.io/product/cli/dif/">
          {t('Learn more about Debug Information Files.')}
        </ExternalLink>
      </p>
      <OptionsContainer>
        <OptionTitleContainer>
          <OptionTitle>{t('Option 1')}</OptionTitle> <Tag>{t('Recommended')}</Tag>
        </OptionTitleContainer>
        <OptionTitleContainer>
          <OptionTitle>{t('Option 2')}</OptionTitle>
        </OptionTitleContainer>
      </OptionsContainer>
      <OptionsContainer>
        <Option>
          <ExternalOptionTitle href="https://docs.sentry.io/platforms/android/proguard/">
            {t('Proguard and DexGuard')}
            <IconOpen />
          </ExternalOptionTitle>
          <p>{t('Upload ProGuard files using our Gradle plugin.')}</p>
        </Option>
        <Option>
          <ExternalOptionTitle href="https://docs.sentry.io/product/cli/dif/#uploading-files">
            {t('Sentry-cli')}
            <IconOpen />
          </ExternalOptionTitle>
          <p>{t('Validate and upload debug files using our cli tool.')}</p>
        </Option>
      </OptionsContainer>
      <ModalFooter>
        <ModalActions>
          <DocsLink />
          <div>
            <StepIndicator>{t('Step 2 of 2')}</StepIndicator>
            {step.previous ? (
              <PreviousStepButton onClick={() => toStep(step.previous)} />
            ) : null}
            <Button priority="primary" onClick={closeModal}>
              {t('Done')}
            </Button>
          </div>
        </ModalActions>
      </ModalFooter>
    </ModalBody>
  );
}

function IOSSendDebugFilesInstruction({
  Body: ModalBody,
  Header: ModalHeader,
  Footer: ModalFooter,
  closeModal,
  toStep,
  step,
}: OnboardingStepProps) {
  return (
    <ModalBody>
      <ModalHeader>
        <h3>{t('Set Up Profiling')}</h3>
      </ModalHeader>
      <p>
        {t(`The most straightforward way to provide Sentry with debug information files is to
        upload them using sentry-cli. Depending on your workflow, you may want to upload
        as part of your build pipeline or when deploying and publishing your application.`)}{' '}
        <ExternalLink href="https://docs.sentry.io/product/cli/dif/">
          {t('Learn more about Debug Information Files.')}
        </ExternalLink>
      </p>
      <OptionsContainer>
        <OptionTitleContainer>
          <OptionTitle>{t('Option 1')}</OptionTitle> <Tag>{t('Recommended')}</Tag>
        </OptionTitleContainer>
        <OptionTitleContainer>
          <OptionTitle>{t('Option 2')}</OptionTitle>
        </OptionTitleContainer>
      </OptionsContainer>
      <OptionsContainer>
        <Option>
          <ExternalOptionTitle href="https://docs.sentry.io/product/cli/dif/#uploading-files">
            {t('Sentry-cli')}
            <IconOpen />
          </ExternalOptionTitle>
          <p>{t('Validate and upload debug files using our cli tool.')}</p>
        </Option>
        <Option>
          <ExternalOptionTitle href="https://docs.sentry.io/platforms/apple/dsym/">
            {t('Symbol servers')}
            <IconOpen />
          </ExternalOptionTitle>
          <p>
            {t('Sentry downloads debug information files from external repositories.')}
          </p>
        </Option>
      </OptionsContainer>
      <ModalFooter>
        <ModalActions>
          <DocsLink />
          <div>
            <StepIndicator>{t('Step 2 of 2')}</StepIndicator>
            {step.previous !== null ? (
              <PreviousStepButton onClick={() => toStep(step.previous)} />
            ) : null}
            <Button priority="primary" onClick={closeModal}>
              {t('Next')}
            </Button>
          </div>
        </ModalActions>
      </ModalFooter>
    </ModalBody>
  );
}

type StepButtonProps = Omit<ButtonPropsWithoutAriaLabel, 'children'>;

// A few common component definitions that are used in each step
function NextStepButton(props: StepButtonProps) {
  return (
    <Button priority="primary" {...props}>
      {t('Next')}
    </Button>
  );
}

function PreviousStepButton(props: StepButtonProps) {
  return <Button {...props}>{t('Back')}</Button>;
}

function DocsLink() {
  return (
    <Button external href="https://docs.sentry.io/product/profiling/">
      {t('Read Docs')}
    </Button>
  );
}

interface ModalActionsProps {
  children: React.ReactNode;
}
function ModalActions({children}: ModalActionsProps) {
  return <ModalActionsContainer>{children}</ModalActionsContainer>;
}

const OptionTitleContainer = styled('div')`
  margin-bottom: ${space(0.5)};
`;

const OptionTitle = styled('span')`
  font-weight: bold;
`;

const ExternalOptionTitle = styled(ExternalLink)`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
  display: flex;
  align-items: center;
  margin-bottom: ${space(0.5)};

  svg {
    margin-left: ${space(0.5)};
  }
`;

const Option = styled('div')`
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  padding: ${space(2)};
  margin-top: ${space(1)};
`;

const OptionsContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(2)};

  > p {
    margin: 0;
  }
`;

const ModalActionsContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: 1 1 100%;

  button:not(:last-child) {
    margin-right: ${space(1)};
  }
`;

const StepTitle = styled('div')`
  margin-bottom: ${space(1)};
  font-weight: bold;
`;

const StepIndicator = styled('span')`
  color: ${p => p.theme.subText};
  margin-right: ${space(2)};
`;
