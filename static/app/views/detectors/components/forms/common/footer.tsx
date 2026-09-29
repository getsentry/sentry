import {Observer} from 'mobx-react-lite';

import {Button, LinkButton} from '@sentry/scraps/button';
import type {CSS} from '@sentry/scraps/cssTypes';

import {FormContext} from 'sentry/components/forms/formContext';
import {EditLayout} from 'sentry/components/workflowEngine/layout/edit';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getSubmitButtonTitle} from 'sentry/views/detectors/components/forms/common/getSubmitButtonTitle';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {
  makeMonitorCreatePathname,
  makeMonitorDetailsPathname,
} from 'sentry/views/detectors/pathnames';

interface NewDetectorFooterProps {
  disabledCreate?: string;
  extras?: React.ReactNode;
  maxWidth?: CSS['maxWidth'];
}

export function NewDetectorFooter({
  maxWidth,
  disabledCreate,
  extras,
}: NewDetectorFooterProps) {
  const organization = useOrganization();
  const {duplicateDetector} = useDetectorFormContext();
  const secondaryAction = duplicateDetector
    ? {
        label: t('Cancel'),
        to: makeMonitorDetailsPathname(organization.slug, duplicateDetector.id),
      }
    : {
        label: t('Back'),
        to: makeMonitorCreatePathname(organization.slug),
      };

  return (
    <FormContext.Consumer>
      {({form}) => (
        <EditLayout.Footer label={t('Step 2 of 2')} maxWidth={maxWidth}>
          <LinkButton variant="secondary" to={secondaryAction.to}>
            {secondaryAction.label}
          </LinkButton>
          {extras}
          <Observer>
            {() => (
              <Button
                variant="primary"
                type="submit"
                busy={form?.isSaving}
                disabled={!!disabledCreate || form?.isFormIncomplete || form?.isError}
                tooltipProps={{
                  title: form
                    ? getSubmitButtonTitle(form, disabledCreate)
                    : disabledCreate,
                }}
              >
                {t('Create Monitor')}
              </Button>
            )}
          </Observer>
        </EditLayout.Footer>
      )}
    </FormContext.Consumer>
  );
}
