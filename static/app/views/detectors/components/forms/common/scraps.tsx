import {Fragment, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import orderBy from 'lodash/orderBy';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {LinkButton} from '@sentry/scraps/button';
import {useStore, withFieldGroup} from '@sentry/scraps/form';
import {Container as LayoutContainer, Flex, Stack} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Separator} from '@sentry/scraps/separator';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {EditableText} from 'sentry/components/editableText';
import {MarkdownTextArea} from 'sentry/components/markdownTextArea';
import {EditLayout} from 'sentry/components/workflowEngine/layout/edit';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t} from 'sentry/locale';
import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useOwnerOptions} from 'sentry/utils/useOwnerOptions';
import {useOwners} from 'sentry/utils/useOwners';
import {useProjects} from 'sentry/utils/useProjects';
import {
  DeleteDetectorAction,
  DisableDetectorAction,
} from 'sentry/views/detectors/components/details/common/actions';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {
  makeMonitorBasePathname,
  makeMonitorDetailsPathname,
  makeMonitorTypePathname,
} from 'sentry/views/detectors/pathnames';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';
import {
  canEditDetector,
  useCanEditDetector,
} from 'sentry/views/detectors/utils/useCanEditDetector';
import {TopBar} from 'sentry/views/navigation/topBar';

export function useInitialDetectorCommonValues() {
  const {projects} = useProjects();
  const {query} = useLocation();
  return useMemo(() => {
    const project = projects.find(candidate => candidate.id === query.project);
    const sorted = orderBy(projects, ['isMember', 'isBookmarked'], ['desc', 'desc']);
    return {
      projectId: project?.id ?? sorted[0]?.id ?? '',
      environment: typeof query.environment === 'string' ? query.environment : '',
      name: typeof query.name === 'string' ? query.name : '',
      owner: typeof query.owner === 'string' ? query.owner : '',
      description: null as string | null,
      workflowIds: [] as string[],
    };
  }, [projects, query.project, query.environment, query.name, query.owner]);
}

export function useDetectorProject(projectId: string) {
  const {projects} = useProjects();
  const project = projects.find(candidate => candidate.id === projectId);
  if (!project) {
    throw new Error('The selected monitor project could not be found');
  }
  return project;
}

export function getDetectorSubmitTitle(
  {isIncomplete, isValid}: {isIncomplete: boolean; isValid: boolean},
  disabledReason?: string
) {
  if (disabledReason) {
    return disabledReason;
  }
  if (isIncomplete) {
    return t('Required fields must be filled out');
  }
  return isValid ? undefined : t('Fields must contain valid inputs');
}

interface DetectorLayoutProps {
  children: React.ReactNode;
  detectorType: DetectorType;
  submitButton: React.ReactNode;
  detector?: Detector;
  extraFooterButton?: React.ReactNode;
  previewChart?: React.ReactNode;
}

export const DetectorFormLayout = withFieldGroup({
  defaultValues: {name: ''},
  props: {} as DetectorLayoutProps,
  render: function DetectorFormLayout({
    group,
    children,
    detectorType,
    detector,
    submitButton,
    extraFooterButton,
    previewChart,
  }) {
    const organization = useOrganization();
    const theme = useTheme();
    const {setHasSetDetectorName} = useDetectorFormContext();
    const canEdit = useCanEditDetector({
      detectorType,
      projectId: detector?.projectId ?? null,
    });
    const maxWidth = theme.breakpoints.xl;
    return (
      <Fragment>
        <EditLayout.Header maxWidth={maxWidth}>
          <TopBar.Slot name="title">
            <Breadcrumbs
              crumbs={[
                {label: t('Monitors'), to: makeMonitorBasePathname(organization.slug)},
                {
                  label: getDetectorTypeLabel(detectorType),
                  to: makeMonitorTypePathname(organization.slug, detectorType),
                },
                {
                  label: (
                    <group.AppField name="name">
                      {field => (
                        <field.Base>
                          {({ref: _ref, ...baseProps}) => (
                            <EditableText
                              {...baseProps}
                              allowEmpty
                              value={field.state.value}
                              onChange={value => {
                                setHasSetDetectorName(true);
                                field.handleChange(value);
                              }}
                              placeholder={t('New Monitor')}
                              aria-label={t('Monitor Name')}
                              variant="compact"
                            />
                          )}
                        </field.Base>
                      )}
                    </group.AppField>
                  ),
                },
              ]}
            />
          </TopBar.Slot>
          <LayoutContainer>
            <MonitorFeedbackButton />
          </LayoutContainer>
          {previewChart && (
            <EditLayout.HeaderFields>{previewChart}</EditLayout.HeaderFields>
          )}
        </EditLayout.Header>
        <EditLayout.Body maxWidth={maxWidth}>{children}</EditLayout.Body>
        <EditLayout.Footer
          maxWidth={maxWidth}
          label={detector ? undefined : t('Step 2 of 2')}
        >
          {detector ? (
            <Fragment>
              <DisableDetectorAction detector={detector} />
              <DeleteDetectorAction detector={detector} />
              {extraFooterButton}
              {(canEdit || !!extraFooterButton) && <Separator orientation="vertical" />}
              <LinkButton
                variant="secondary"
                size="sm"
                to={makeMonitorDetailsPathname(organization.slug, detector.id)}
              >
                {t('Cancel')}
              </LinkButton>
            </Fragment>
          ) : (
            <Fragment>
              <LinkButton
                variant="secondary"
                to={`${makeMonitorBasePathname(organization.slug)}new/`}
              >
                {t('Back')}
              </LinkButton>
              {extraFooterButton}
            </Fragment>
          )}
          {submitButton}
        </EditLayout.Footer>
      </Fragment>
    );
  },
});

interface ProjectProps {
  detectorType: DetectorType;
  detector?: Detector;
  step?: number;
}

const DetectorProjectField = withFieldGroup({
  defaultValues: {projectId: ''},
  props: {} as ProjectProps,
  render: function DetectorProjectField({group, detectorType, detector}) {
    const {projects, fetching} = useProjects();
    const organization = useOrganization();
    const validatePermission = ({value}: {value: string}) =>
      canEditDetector({
        organization,
        detectorType,
        project: projects.find(project => project.id === value),
      })
        ? undefined
        : {
            message: t(
              'You do not have permission to create or edit monitors in this project'
            ),
          };
    const options = ['member', 'all'].map(key => ({
      label: key === 'member' ? t('My Projects') : t('All Projects'),
      options: projects
        .filter(project => (project.isMember ? 'member' : 'all') === key)
        .map(project => ({
          value: project.id,
          label: project.slug,
          leadingItems: <ProjectAvatar project={project} size={20} />,
        })),
    }));
    return (
      <LayoutContainer flex={1} maxWidth="260px">
        <group.AppField
          name="projectId"
          validators={{
            onChange: validatePermission,
            onSubmit: validatePermission,
          }}
        >
          {field => (
            <field.Layout.Stack label={t('Project')} required>
              <field.Base
                disabled={
                  detector
                    ? t("A monitor's project can't be changed after it's been created.")
                    : fetching
                }
              >
                {({ref: _ref, id, ...baseProps}) => (
                  <Select
                    {...baseProps}
                    inputId={id}
                    value={field.state.value}
                    onChange={option => field.handleChange(option.value)}
                    options={options}
                    placeholder={t('Project')}
                    aria-label={t('Select Project')}
                    size="sm"
                  />
                )}
              </field.Base>
            </field.Layout.Stack>
          )}
        </group.AppField>
      </LayoutContainer>
    );
  },
});

export const DetectorProjectSection = withFieldGroup({
  defaultValues: {projectId: ''},
  props: {} as ProjectProps,
  render: ({group, step, ...props}) => (
    <Container>
      <FormSection
        step={step}
        title={t('Choose a Project')}
        description={t('This is where issues will be created.')}
      >
        <DetectorProjectField form={group} fields={{projectId: 'projectId'}} {...props} />
      </FormSection>
    </Container>
  ),
});

export const DetectorProjectEnvironmentSection = withFieldGroup({
  defaultValues: {projectId: '', environment: ''},
  props: {} as ProjectProps & {
    includeAllEnvironments?: boolean;
    requiredEnvironment?: boolean;
  },
  render: function DetectorProjectEnvironmentSection({
    group,
    step,
    includeAllEnvironments = true,
    requiredEnvironment = false,
    ...props
  }) {
    const projectId = useStore(group.store, state => state.values.projectId);
    const project = useDetectorProject(projectId);
    const [newEnvironment, setNewEnvironment] = useState<string>();
    const options = [
      ...(includeAllEnvironments ? [{value: '', label: t('All Environments')}] : []),
      ...(newEnvironment ? [{value: newEnvironment, label: newEnvironment}] : []),
      ...(project.environments ?? []).map(environment => ({
        value: environment,
        label: environment,
      })),
    ];
    return (
      <Container>
        <FormSection
          step={step}
          title={t('Choose the Project and Environment')}
          description={t('This is where issues will be created.')}
        >
          <Flex gap="md">
            <DetectorProjectField
              form={group}
              fields={{projectId: 'projectId'}}
              {...props}
            />
            <LayoutContainer flex={1} maxWidth="260px">
              <group.AppField name="environment">
                {field => (
                  <field.Layout.Stack
                    label={t('Environment')}
                    required={requiredEnvironment}
                  >
                    <field.Select
                      value={field.state.value}
                      onChange={environment => {
                        if (!project.environments?.includes(environment)) {
                          setNewEnvironment(environment);
                        }
                        field.handleChange(environment);
                      }}
                      options={options}
                      creatable
                      placeholder={t('Environment')}
                      aria-label={t('Select Environment')}
                    />
                  </field.Layout.Stack>
                )}
              </group.AppField>
            </LayoutContainer>
          </Flex>
        </FormSection>
      </Container>
    );
  },
});

export const DetectorOwnershipSection = withFieldGroup({
  defaultValues: {projectId: '', owner: '', description: null as string | null},
  props: {} as {step?: number},
  render: function DetectorOwnershipSection({group, step}) {
    const projectId = useStore(group.store, state => state.values.projectId);
    const owner = useStore(group.store, state => state.values.owner);
    const project = useDetectorProject(projectId);
    const currentValue = useMemo(() => (owner ? [owner] : undefined), [owner]);
    const {teams, members, fetching, onTeamSearch, onMemberSearch} = useOwners({
      currentValue,
    });
    const options = useOwnerOptions({
      teams,
      members,
      avatarProps: {size: 20},
      memberOfProjectSlugs: [project.slug],
    });
    return (
      <Container>
        <FormSection step={step} title={t('Issue Ownership')}>
          <Stack gap="lg">
            <group.AppField name="owner">
              {field => (
                <field.Layout.Stack
                  label={t('Assign')}
                  hintText={t(
                    'Sentry will assign issues detected by this monitor to this individual or team.'
                  )}
                >
                  <field.Base>
                    {({ref: _ref, id, ...baseProps}) => (
                      <Select
                        {...baseProps}
                        inputId={id}
                        value={field.state.value}
                        onChange={option => field.handleChange(option?.value ?? '')}
                        options={options}
                        clearable
                        isLoading={fetching}
                        placeholder={t('Select a member or team')}
                        onInputChange={value => {
                          onMemberSearch(value);
                          onTeamSearch(value);
                        }}
                      />
                    )}
                  </field.Base>
                </field.Layout.Stack>
              )}
            </group.AppField>
            <group.AppField name="description">
              {field => (
                <field.Layout.Stack
                  label={t('Describe')}
                  hintText={t(
                    'Add any additional context about this monitor for other team members.'
                  )}
                >
                  <field.Base>
                    {({ref: _ref, ...baseProps}) => (
                      <MarkdownTextArea
                        {...baseProps}
                        value={field.state.value ?? ''}
                        onChange={event => field.handleChange(event.target.value)}
                        aria-label={t('description')}
                        placeholder={t(
                          'Example monitor description\n\nTo debug follow these steps:\n1. \u2026\n2. \u2026\n3. \u2026'
                        )}
                      />
                    )}
                  </field.Base>
                </field.Layout.Stack>
              )}
            </group.AppField>
          </Stack>
        </FormSection>
      </Container>
    );
  },
});
