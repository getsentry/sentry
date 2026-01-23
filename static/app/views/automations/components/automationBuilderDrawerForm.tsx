import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Observer} from 'mobx-react-lite';

import {addLoadingMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {Flex, Stack} from 'sentry/components/core/layout';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import AutomationBuilder from 'sentry/views/automations/components/automationBuilder';
import {
  AutomationBuilderContext,
  useAutomationBuilderReducer,
} from 'sentry/views/automations/components/automationBuilderContext';
import {AutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';
import type {AutomationFormData} from 'sentry/views/automations/components/automationFormData';
import {
  getNewAutomationData,
  validateAutomationBuilderState,
} from 'sentry/views/automations/components/automationFormData';
import {ActionIntervalSelectField} from 'sentry/views/automations/components/forms/actionIntervalSelectField';
import {getAutomationAnalyticsPayload} from 'sentry/views/automations/components/forms/common/getAutomationAnalyticsPayload';
import {
  AutomationFormProvider,
  useAutomationFormContext,
} from 'sentry/views/automations/components/forms/context';
import {useSetAutomaticAutomationName} from 'sentry/views/automations/components/forms/useSetAutomaticAutomationName';
import {useCreateAutomation} from 'sentry/views/automations/hooks';
import {useAutomationBuilderErrors} from 'sentry/views/automations/hooks/useAutomationBuilderErrors';
import {resolveDetectorIdsForProjects} from 'sentry/views/automations/utils/resolveDetectorIdsForProjects';

const DEFAULT_INITIAL_DATA = {
  name: '',
  environment: null,
  frequency: 1440,
  projectIds: [],
  detectorIds: [],
};

interface AutomationBuilderDrawerProps {
  closeDrawer: () => void;
  initialData?: Partial<{
    detectorIds: string[];
    frequency: number;
    name: string;
    projectIds: string[];
  }>;
  onSuccess?: (automationId: string) => void;
}

function FormBody({closeDrawer, model}: {closeDrawer: () => void; model: FormModel}) {
  useSetAutomaticAutomationName();
  const {setHasSetAutomationName} = useAutomationFormContext();

  return (
    <DrawerBody>
      <Stack direction="column" gap="xl">
        <Flex direction="column" gap="lg">
          <Stack gap="md">
            <AutomationBuilder />
          </Stack>
          <ActionIntervalSelectField
            label={t('Action Interval')}
            help={t('Perform the actions above this often for an issue.')}
          />
        </Flex>
        <EmbeddedTextField
          required
          name="name"
          label={t('Alert Name')}
          placeholder={t('Notify via Email')}
          onKeyDown={() => setHasSetAutomationName(true)}
          inline={false}
        />
        <Flex justify="end" gap="md">
          <Button type="button" onClick={closeDrawer}>
            {t('Cancel')}
          </Button>
          <Observer>
            {() => (
              <Button priority="primary" type="submit" disabled={model.isSaving}>
                {t('Create Alert')}
              </Button>
            )}
          </Observer>
        </Flex>
      </Stack>
    </DrawerBody>
  );
}

/**
 * A miminal form for creating a new automation, meant to be rendered in a drawer.
 */
export function AutomationBuilderDrawerForm({
  onSuccess,
  closeDrawer,
  initialData,
}: AutomationBuilderDrawerProps) {
  const organization = useOrganization();
  const model = useMemo(() => new FormModel(), []);
  const {state, actions} = useAutomationBuilderReducer();
  const queryClient = useQueryClient();

  const {
    errors: automationBuilderErrors,
    setErrors: setAutomationBuilderErrors,
    removeError,
  } = useAutomationBuilderErrors();

  const {mutateAsync: createAutomation, error} = useCreateAutomation();

  const handleSubmit = useCallback<OnSubmitCallback>(
    async (data, onSubmitSuccess, onSubmitError, _event, formModel) => {
      const errors = validateAutomationBuilderState(state);
      setAutomationBuilderErrors(errors);

      if (Object.keys(errors).length > 0) {
        trackAnalytics('automation.created', {
          organization,
          ...getAutomationAnalyticsPayload(
            getNewAutomationData({
              data: data as AutomationFormData,
              state,
            })
          ),
          source: 'drawer',
          success: false,
        });
        return;
      }

      const formData = await resolveDetectorIdsForProjects({
        formData: data as AutomationFormData,
        onSubmitError,
        orgSlug: organization.slug,
        projectIds: data.projectIds,
        queryClient,
      });
      if (!formData) {
        return;
      }
      const analyticsPayload = getAutomationAnalyticsPayload(
        getNewAutomationData({
          data: formData,
          state,
        })
      );

      try {
        formModel.setFormSaving();
        addLoadingMessage(t('Creating Alert...'));
        const newAutomationData = getNewAutomationData({
          data: formData,
          state,
        });
        const automation = await createAutomation(newAutomationData);
        onSubmitSuccess(formModel.getData());
        trackAnalytics('automation.created', {
          organization,
          ...analyticsPayload,
          source: 'drawer',
          success: true,
        });
        onSuccess?.(automation.id);
        addSuccessMessage(t('Alert created'));
      } catch (err) {
        onSubmitError(err);
        Sentry.logger.warn('Create alert request failure (drawer)', {
          error: err,
          details: analyticsPayload,
        });
        trackAnalytics('automation.created', {
          organization,
          ...analyticsPayload,
          source: 'drawer',
          success: false,
        });
      }
    },
    [
      state,
      setAutomationBuilderErrors,
      queryClient,
      organization,
      createAutomation,
      onSuccess,
    ]
  );

  return (
    <Form
      hideFooter
      initialData={{...DEFAULT_INITIAL_DATA, ...initialData}}
      onSubmit={handleSubmit}
      model={model}
    >
      <AutomationFormProvider>
        <DrawerHeader hideBar />
        <AutomationBuilderErrorContext.Provider
          value={{
            errors: automationBuilderErrors,
            setErrors: setAutomationBuilderErrors,
            removeError,
            mutationErrors: error?.responseJSON,
          }}
        >
          <AutomationBuilderContext.Provider
            value={{
              state,
              actions,
              showTriggerLogicTypeSelector: false,
            }}
          >
            <FormBody closeDrawer={closeDrawer} model={model} />
          </AutomationBuilderContext.Provider>
        </AutomationBuilderErrorContext.Provider>
      </AutomationFormProvider>
    </Form>
  );
}

const EmbeddedTextField = styled(TextField)`
  padding: 0;
`;
