import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import {Observer} from 'mobx-react-lite';

import {Button} from '@sentry/scraps/button';

import FormContext from 'sentry/components/forms/formContext';
import FormModel from 'sentry/components/forms/model';
import type {Data} from 'sentry/components/forms/types';
import {useFormEagerValidation} from 'sentry/components/forms/useFormEagerValidation';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {t} from 'sentry/locale';
import type {
  BaseDetectorUpdatePayload,
  Detector,
} from 'sentry/types/workflowEngine/detectors';
import {
  DeleteDetectorAction,
  DisableDetectorAction,
} from 'sentry/views/detectors/components/details/common/actions';
import {EditDetectorBreadcrumbs} from 'sentry/views/detectors/components/forms/common/breadcrumbs';
import {DetectorBaseFields} from 'sentry/views/detectors/components/forms/detectorBaseFields';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {useEditDetectorFormSubmit} from 'sentry/views/detectors/hooks/useEditDetectorFormSubmit';

function getSubmitButtonTitle(form: FormModel): string | undefined {
  if (form.isFormIncomplete) {
    return t('Required fields must be filled out');
  }

  if (form.isError) {
    return t('Form contains errors');
  }

  return undefined;
}

type EditDetectorLayoutProps<TDetector, TFormData, TUpdatePayload> = {
  children: React.ReactNode;
  detector: TDetector;
  formDataToEndpointPayload: (formData: TFormData) => TUpdatePayload;
  savedDetectorToFormData: (detector: TDetector) => TFormData;
  environment?: React.ComponentProps<typeof DetectorBaseFields>['environment'];
  extraFooterButton?: React.ReactNode;
  mapFormErrors?: (error: any) => any;
  previewChart?: React.ReactNode;
};

export function EditDetectorLayout<
  TDetector extends Detector,
  TFormData extends Data,
  TUpdatePayload extends BaseDetectorUpdatePayload,
>({
  previewChart,
  detector,
  children,
  formDataToEndpointPayload,
  savedDetectorToFormData,
  mapFormErrors,
  environment,
  extraFooterButton,
}: EditDetectorLayoutProps<TDetector, TFormData, TUpdatePayload>) {
  const theme = useTheme();
  const maxWidth = theme.breakpoints.xl;
  const [formModel] = useState(() => new FormModel());
  const {onBlur, onFieldChange} = useFormEagerValidation(formModel);

  const handleFormSubmit = useEditDetectorFormSubmit({
    detector,
    formDataToEndpointPayload,
  });

  const initialData = useMemo(() => {
    return savedDetectorToFormData(detector);
  }, [detector, savedDetectorToFormData]);

  const formProps = {
    model: formModel,
    initialData,
    onSubmit: handleFormSubmit,
    onFieldChange,
    onBlur,
    mapFormErrors,
  };

  return (
    <EditLayout formProps={formProps}>
      <EditLayout.Header maxWidth={maxWidth}>
        <EditLayout.HeaderContent>
          <EditDetectorBreadcrumbs detector={detector} />
        </EditLayout.HeaderContent>

        <div>
          <EditLayout.Actions>
            <MonitorFeedbackButton />
          </EditLayout.Actions>
        </div>

        <EditLayout.HeaderFields>
          <DetectorBaseFields environment={environment} />
          {previewChart ?? <div />}
        </EditLayout.HeaderFields>
      </EditLayout.Header>

      <EditLayout.Body maxWidth={maxWidth}>{children}</EditLayout.Body>

      <FormContext.Consumer>
        {({form}) => (
          <EditLayout.Footer maxWidth={maxWidth}>
            <DisableDetectorAction detector={detector} />
            <DeleteDetectorAction detector={detector} />
            {extraFooterButton}
            <Observer>
              {() => (
                <Button
                  type="submit"
                  priority="primary"
                  size="sm"
                  disabled={form?.isFormIncomplete || form?.isError || form?.isSaving}
                  title={form ? getSubmitButtonTitle(form) : undefined}
                >
                  {t('Save')}
                </Button>
              )}
            </Observer>
          </EditLayout.Footer>
        )}
      </FormContext.Consumer>
    </EditLayout>
  );
}
