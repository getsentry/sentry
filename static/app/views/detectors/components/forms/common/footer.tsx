import {Observer} from 'mobx-react-lite';

import {Button, LinkButton} from '@sentry/scraps/button';

import FormContext from 'sentry/components/forms/formContext';
import type FormModel from 'sentry/components/forms/model';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';

function getSubmitButtonTitle(
  form: FormModel,
  disabledCreate?: string
): string | undefined {
  if (disabledCreate) {
    return disabledCreate;
  }

  if (form.isFormIncomplete) {
    return t('Required fields must be filled out');
  }

  if (form.isError) {
    return t('Form contains errors');
  }

  return undefined;
}

interface NewDetectorFooterProps {
  disabledCreate?: string;
  extras?: React.ReactNode;
  maxWidth?: string;
}

export function NewDetectorFooter({
  maxWidth,
  disabledCreate,
  extras,
}: NewDetectorFooterProps) {
  const organization = useOrganization();

  return (
    <FormContext.Consumer>
      {({form}) => (
        <EditLayout.Footer label={t('Step 2 of 2')} maxWidth={maxWidth}>
          <LinkButton
            priority="default"
            to={`${makeMonitorBasePathname(organization.slug)}new/`}
          >
            {t('Back')}
          </LinkButton>
          {extras}
          <Observer>
            {() => (
              <Button
                priority="primary"
                type="submit"
                disabled={
                  !!disabledCreate ||
                  form?.isFormIncomplete ||
                  form?.isError ||
                  form?.isSaving
                }
                title={form ? getSubmitButtonTitle(form, disabledCreate) : disabledCreate}
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
