import {useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import {Observer} from 'mobx-react-lite';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Separator} from '@sentry/scraps/separator';

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
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  DeleteDetectorAction,
  DisableDetectorAction,
} from 'sentry/views/detectors/components/details/common/actions';
import {DetectorFormBreadcrumbs} from 'sentry/views/detectors/components/forms/common/breadcrumbs';
import {getSubmitButtonTitle} from 'sentry/views/detectors/components/forms/common/getSubmitButtonTitle';
import {MonitorFeedbackButton} from 'sentry/views/detectors/components/monitorFeedbackButton';
import {useEditDetectorFormSubmit} from 'sentry/views/detectors/hooks/useEditDetectorFormSubmit';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';
import {useCanEditDetector} from 'sentry/views/detectors/utils/useCanEditDetector';
import {TopBar} from 'sentry/views/navigation/topBar';

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
  const organization = useOrganization();
  const maxWidth = theme.breakpoints.xl;
  const [formModel] = useState(() => new FormModel());
  const {onFieldChange} = useFormEagerValidation(formModel);

  const handleFormSubmit = useEditDetectorFormSubmit({
    detector,
    formDataToEndpointPayload,
  });

  // Without edit access, the disable and delete buttons are hidden,
  // so we should not show the separator
  const canEditDetector = useCanEditDetector({
    detectorType: detector.type,
    projectId: detector.projectId,
  });

  const shouldShowSeparator = canEditDetector || Boolean(extraFooterButton);

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
        <TopBar.Slot name="title">
          <DetectorFormBreadcrumbs />
        </TopBar.Slot>

        <div>
          <EditLayoutDeprecated.Actions>
            <MonitorFeedbackButton />
          </EditLayoutDeprecated.Actions>
        </div>

        {previewChart && (
          <EditLayoutDeprecated.HeaderFields>
            {previewChart}
          </EditLayoutDeprecated.HeaderFields>
        )}
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
            {shouldShowSeparator && <Separator orientation="vertical" />}
            <LinkButton
              variant="secondary"
              size="sm"
              to={makeMonitorDetailsPathname(organization.slug, detector.id)}
            >
              {t('Cancel')}
            </LinkButton>
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
