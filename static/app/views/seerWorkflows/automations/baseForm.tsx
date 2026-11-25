import type {ReactNode, RefObject} from 'react';

import {Container, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import type {SeerWorkflowConfigResponse} from 'sentry/views/seerWorkflows/types';

/**
 * Lets callers outside an automation form discard its unsaved changes
 */
export type AutomationFormHandle = {reset: () => void};

export type CreateAutomationFormProps = {mode: 'create'};

export type EditAutomationFormProps = {
  config: SeerWorkflowConfigResponse;
  /**
   * Lets a submit button outside the form target it
   */
  formId: string;
  /**
   * Exposes the form's reset so callers outside the form can discard changes
   */
  formRef: RefObject<AutomationFormHandle | null>;
  mode: 'edit';
  /**
   * Name edited outside the form, in the page header
   */
  name: string;
  onSaved: () => void;
  /**
   * Prevents editing until the user starts configuring
   */
  readOnly: boolean;
  /**
   * Reports whether any field differs from its saved value
   */
  setFormHasChanges: (hasChanges: boolean) => void;
};

export function FormSection({title, children}: {children: ReactNode; title: string}) {
  return (
    <Stack gap="md">
      <Container paddingLeft="md">
        <Heading as="h2" size="lg">
          {title}
        </Heading>
      </Container>
      {children}
    </Stack>
  );
}
