import {useRef} from 'react';
import {IconAdd} from '@sentry/icons/add';

import {Button} from '@sentry/scraps/button';
import {withForm} from '@sentry/scraps/form';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {ENRICHMENT_ATTRIBUTE_PREFIX} from 'sentry/views/classifiers/utils';

import {WizardBody, WizardFooter, WizardStep} from './wizardLayout';

export const ClassifierDetailsStep = withForm({
  defaultValues: {name: '', resultAttribute: ''},
  props: {} as {onBack: () => void},
  render: function ClassifierDetailsStepRender({form, onBack}) {
    const attributeInputRef = useRef<HTMLInputElement>(null);

    return (
      <WizardStep>
        <form.AppForm form={form}>
          <WizardBody maxWidth="622px">
            <form.AppField name="name">
              {field => (
                <field.Layout.Stack
                  label={t('Classifier title')}
                  hintText={t('This is what the classifier is called within Sentry.')}
                  required
                >
                  <field.Input value={field.state.value} onChange={field.handleChange} />
                </field.Layout.Stack>
              )}
            </form.AppField>
            <form.AppField name="resultAttribute">
              {field => (
                <field.Layout.Stack
                  label={t('Attribute name')}
                  hintText={t(
                    'This is how the attribute is listed when it surfaces. This might be difficult to change later.'
                  )}
                  required
                >
                  <field.Input
                    ref={attributeInputRef}
                    value={field.state.value}
                    onChange={field.handleChange}
                    leadingItems={
                      <Text
                        monospace
                        variant="muted"
                        onClick={() => attributeInputRef.current?.focus()}
                      >
                        {ENRICHMENT_ATTRIBUTE_PREFIX}
                      </Text>
                    }
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>
          </WizardBody>
        </form.AppForm>
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
  },
});
