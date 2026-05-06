import {useCallback, useContext, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {useDrawer} from '@sentry/scraps/drawer';
import {withFieldGroup} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import {FormContext} from 'sentry/components/forms/formContext';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {IconAdd, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {AutomationBuilderDrawerForm} from 'sentry/views/automations/components/automationBuilderDrawerForm';
import {ConnectAutomationsDrawer} from 'sentry/views/detectors/components/connectAutomationsDrawer';
import {ConnectedAutomationsList} from 'sentry/views/detectors/components/connectedAutomationList';
import {ConnectedAlertsEmptyState} from 'sentry/views/detectors/components/connectedAutomationsEmptyState';
import {useDetectorFormProject} from 'sentry/views/detectors/components/forms/common/useDetectorFormProject';

/**
 * Section that lets the user connect, disconnect, and create automations
 * for the detector being edited.
 */
export const AutomateSection = withFieldGroup({
  defaultValues: {workflowIds: [] as string[]},
  props: {} as {project: Project; step?: number},
  render: ({group, step, project}) => (
    <group.AppField name="workflowIds">
      {field => (
        <AutomateSectionInner
          step={step}
          project={project}
          workflowIds={field.state.value}
          setWorkflowIds={field.handleChange}
        />
      )}
    </group.AppField>
  ),
});

/**
 * Legacy variant of {@link AutomateSection} for detector forms still using
 * the legacy `FormModel` / `FormContext`. Reads and writes `workflowIds`
 * via the surrounding form context.
 *
 * Remove once all detector forms have migrated to the new form system.
 */
export function AutomateSectionDeprecated({step}: {step?: number}) {
  const formContext = useContext(FormContext);
  const project = useDetectorFormProject();
  const workflowIds = useFormField<string[]>('workflowIds') ?? [];
  const setWorkflowIds = useCallback(
    (next: string[]) => formContext.form?.setValue('workflowIds', next),
    [formContext.form]
  );

  return (
    <AutomateSectionInner
      step={step}
      workflowIds={workflowIds}
      setWorkflowIds={setWorkflowIds}
      project={project}
    />
  );
}

interface AutomateSectionInnerProps {
  project: Project;
  setWorkflowIds: (workflowIds: string[]) => void;
  workflowIds: string[];
  step?: number;
}

function AutomateSectionInner({
  step,
  workflowIds,
  setWorkflowIds,
  project,
}: AutomateSectionInnerProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const {openDrawer, closeDrawer, isDrawerOpen} = useDrawer();

  const toggleDrawer = () => {
    if (isDrawerOpen) {
      closeDrawer();
      return;
    }

    openDrawer(
      () => (
        <ConnectAutomationsDrawer
          initialWorkflowIds={workflowIds}
          setWorkflowIds={setWorkflowIds}
        />
      ),
      {
        ariaLabel: t('Connect Alerts'),
        shouldCloseOnInteractOutside: el => {
          if (!ref.current) {
            return true;
          }
          return !ref.current.contains(el);
        },
      }
    );
  };

  const openCreateDrawer = () => {
    if (isDrawerOpen) {
      closeDrawer();
    }

    openDrawer(
      () => (
        <AutomationBuilderDrawerForm
          closeDrawer={closeDrawer}
          onSuccess={automationId => {
            setWorkflowIds([...workflowIds, automationId]);
            closeDrawer();
          }}
        />
      ),
      {ariaLabel: t('Create New Alert')}
    );
  };

  if (workflowIds.length > 0) {
    return (
      <Container>
        <FormSection step={step} title={t('Connected Alerts')}>
          <ConnectedAutomationsList
            automationIds={workflowIds}
            cursor={undefined}
            onCursor={() => {}}
            limit={null}
            openInNewTab
          />
        </FormSection>
        <ButtonWrapper justify="between">
          <Button size="sm" icon={<IconAdd />} onClick={openCreateDrawer}>
            {t('Create New Alert')}
          </Button>
          <Button size="sm" icon={<IconEdit />} onClick={toggleDrawer}>
            {t('Edit Alerts')}
          </Button>
        </ButtonWrapper>
      </Container>
    );
  }

  return (
    <Container>
      <FormSection
        step={step}
        title={t('Alert')}
        description={t('Configure alerting on this Monitor to get notified on issues.')}
      >
        <ConnectedAutomationsList
          automationIds={[]}
          cursor={undefined}
          onCursor={() => {}}
          emptyMessage={
            <ConnectedAlertsEmptyState project={project}>
              <Button
                ref={ref}
                size="sm"
                style={{width: 'min-content'}}
                onClick={toggleDrawer}
              >
                {t('Connect Existing Alerts')}
              </Button>
              <Button size="sm" onClick={openCreateDrawer}>
                {t('Create New Alert')}
              </Button>
            </ConnectedAlertsEmptyState>
          }
        />
      </FormSection>
    </Container>
  );
}

const ButtonWrapper = styled(Flex)`
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${p => p.theme.space.xl};
  margin: -${p => p.theme.space.lg};
`;
