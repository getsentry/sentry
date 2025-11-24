import {useCallback, useContext, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import FormContext from 'sentry/components/forms/formContext';
import useDrawer from 'sentry/components/globalDrawer';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {IconAdd, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ConnectAutomationsDrawer} from 'sentry/views/detectors/components/connectAutomationsDrawer';
import {ConnectedAutomationsList} from 'sentry/views/detectors/components/connectedAutomationList';

export function AutomateSection() {
  const ref = useRef<HTMLButtonElement>(null);
  const formContext = useContext(FormContext);
  const {openDrawer, closeDrawer, isDrawerOpen} = useDrawer();

  const workflowIds = useFormField('workflowIds') as string[];
  const setWorkflowIds = useCallback(
    (newWorkflowIds: string[]) =>
      formContext.form?.setValue('workflowIds', newWorkflowIds),
    [formContext.form]
  );

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

  if (workflowIds.length > 0) {
    return (
      <Container>
        <Section title={t('Connected Alerts')}>
          <ConnectedAutomationsList
            automationIds={workflowIds}
            cursor={undefined}
            onCursor={() => {}}
            limit={null}
            openInNewTab
          />
        </Section>
        <ButtonWrapper justify="between">
          {/* TODO: Implement create automation flow */}
          <Button size="sm" icon={<IconAdd />} disabled>
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
      <Section
        title={t('Alert')}
        description={t('Set up alerts to get notified on issues.')}
      >
        <Button
          ref={ref}
          size="sm"
          style={{width: 'min-content'}}
          priority="primary"
          icon={<IconAdd />}
          onClick={toggleDrawer}
        >
          {t('Connect an Alert')}
        </Button>
      </Section>
    </Container>
  );
}

const ButtonWrapper = styled(Flex)`
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(2)};
  margin: -${space(2)};
`;
