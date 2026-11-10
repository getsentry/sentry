import {IconAdd} from '@sentry/icons/add';

import {Button} from '@sentry/scraps/button';
import {ScrapsForm} from '@sentry/scraps/form';

import {t} from 'sentry/locale';
import type {useClassifierForm} from 'sentry/views/classifiers/hooks/useClassifierForm';

import {WizardBody, WizardFooter, WizardStep} from './wizardLayout';

export function ClassifierDetailsStep({
  form,
  onBack,
}: {
  form: ReturnType<typeof useClassifierForm>['form'];
  onBack: () => void;
}) {
  return (
    <WizardStep>
      <ScrapsForm form={form}>
        <WizardBody maxWidth="622px">
          <form.Field name="name">
            {field => (
              <field.Layout.Stack
                label={t('Classifier title')}
                hintText={t('This is what the classifier is called within Sentry.')}
                required
              >
                <field.Input value={field.value} onChange={field.handleChange} />
              </field.Layout.Stack>
            )}
          </form.Field>
          <form.Field name="resultAttribute">
            {field => (
              <field.Layout.Stack
                label={t('Attribute name')}
                hintText={t(
                  'This is how the attribute is listed when it surfaces. This might be difficult to change later.'
                )}
                required
              >
                <field.Input value={field.value} onChange={field.handleChange} />
              </field.Layout.Stack>
            )}
          </form.Field>
        </WizardBody>
      </ScrapsForm>
      <WizardFooter step={2}>
        <Button onClick={onBack}>{t('Back')}</Button>
        <form.Subscribe selector={state => state.isSubmitting}>
          {isSubmitting => (
            <Button
              type="submit"
              form={form.formId}
              variant="primary"
              icon={<IconAdd />}
              busy={isSubmitting}
              disabled={isSubmitting}
            >
              {t('Create classifier')}
            </Button>
          )}
        </form.Subscribe>
      </WizardFooter>
    </WizardStep>
  );
}
