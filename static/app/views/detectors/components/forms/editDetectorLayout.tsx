import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import {Observer} from 'mobx-react-lite';

import {Button} from '@sentry/scraps/button';

import {FormContext} from 'sentry/components/forms/formContext';
import {FormModel} from 'sentry/components/forms/model';
import type {Data} from 'sentry/components/forms/types';
import {useFormEagerValidation} from 'sentry/components/forms/useFormEagerValidation';
import {EditLayoutDeprecated} from 'sentry/components/workflowEngine/layout/edit';
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
import {DetectorNameField} from 'sentry/views/detectors/components/forms/common/detectorNameField';
import {getSubmitButtonTitle} from 'sentry/views/detectors/components/forms/common/getSubmitButtonTitle';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {useEditDetectorFormSubmit} from 'sentry/views/detectors/hooks/useEditDetectorFormSubmit';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

type EditDetectorLayoutProps<TDetector, TFormData, TUpdatePayload> = {
  children: React.ReactNode;
  detector: TDetector;
  formDataToEndpointPayload: (formData: TFormData) => TUpdatePayload;
  savedDetectorToFormData: (detector: TDetector) => TFormData;
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
  extraFooterButton,
}: EditDetectorLayoutProps<TDetector, TFormData, TUpdatePayload>) {
  const theme = useTheme();
  const maxWidth = theme.breakpoints.xl;
  const hasPageFrame = useHasPageFrameFeature();
  const [formModel] = useState(() => new FormModel());
  const {onFieldChange} = useFormEagerValidation(formModel);

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
    mapFormErrors,
  };

  return (
    <EditLayoutDeprecated formProps={formProps}>
      <EditLayoutDeprecated.Header maxWidth={maxWidth}>
        <EditLayoutDeprecated.HeaderContent>
          {hasPageFrame ? (
            <TopBar.Slot name="title">
              <EditDetectorBreadcrumbs detector={detector} />
            </TopBar.Slot>
          ) : (
            <EditDetectorBreadcrumbs detector={detector} />
          )}
        </EditLayoutDeprecated.HeaderContent>

        <div>
          <EditLayoutDeprecated.Actions>
            <MonitorFeedbackButton />
          </EditLayoutDeprecated.Actions>
        </div>

        <EditLayoutDeprecated.HeaderFields>
          <DetectorNameField />
          {previewChart ?? <div />}
        </EditLayoutDeprecated.HeaderFields>
      </EditLayoutDeprecated.Header>

      <EditLayoutDeprecated.Body maxWidth={maxWidth}>
        {children}
      </EditLayoutDeprecated.Body>

      <FormContext.Consumer>
        {({form}) => (
          <EditLayoutDeprecated.Footer maxWidth={maxWidth}>
            <DisableDetectorAction detector={detector} />
            <DeleteDetectorAction detector={detector} />
            {extraFooterButton}
            <Observer>
              {() => (
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  busy={form?.isSaving}
                  disabled={form?.isFormIncomplete || form?.isError}
                  tooltipProps={{title: form ? getSubmitButtonTitle(form) : undefined}}
                >
                  {t('Save')}
                </Button>
              )}
            </Observer>
          </EditLayoutDeprecated.Footer>
        )}
      </FormContext.Consumer>
    </EditLayoutDeprecated>
  );
}
