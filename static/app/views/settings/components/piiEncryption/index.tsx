import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, FormSearch, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Stand-in for the key already configured for this organization. Hardcoded until the API stores it.
 */
const CONFIGURED_PUBLIC_KEY = '';

const schema = z.object({
  piiPublicKey: z
    .string()
    // 32 raw bytes of X25519 key material, base64-encoded.
    .refine(value => value === '' || /^[A-Za-z0-9+/]{43}=$/.test(value), {
      message: t('Enter a base64-encoded 32-byte public key'),
    }),
});

export function PiiEncryption() {
  const organization = useOrganization();
  const hasOrgWrite = organization.access.includes('org:write');

  const form = useScrapsForm({
    ...defaultFormOptions,
    formId: 'organization-pii-encryption',
    defaultValues: {piiPublicKey: CONFIGURED_PUBLIC_KEY},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      // Hardcoded for now: there is nowhere to persist the key yet.
      form.reset({piiPublicKey: value.piiPublicKey});
      addSuccessMessage(
        value.piiPublicKey ? t('Public key saved') : t('Public key removed')
      );
    },
  });

  return (
    <FormSearch route="/settings/:orgId/security-and-privacy/">
      <form.AppForm form={form}>
        <form.FieldGroup title={t('PII Encryption')}>
          <form.AppField name="piiPublicKey">
            {field => (
              <field.Layout.Row
                label={t('Public Key')}
                hintText={tct(
                  'Values matched by an [encrypt] data scrubbing rule are sealed against this key instead of being destroyed. Generate a keypair with [link:the decrypt-pii script] and paste the public half here — keep the private half, which is the only thing that can read those values back.',
                  {
                    encrypt: <code>encrypt</code>,
                    link: (
                      <ExternalLink href="https://github.com/getsentry/relay/blob/master/scripts/decrypt-pii.py" />
                    ),
                  }
                )}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="e.g. hL8xQ0mZ3vT7pKdN9sRfY2wJc1AoUiE4bXgVzHnQmS0="
                  disabled={!hasOrgWrite}
                  aria-label={t('Public key')}
                  monospace
                />
              </field.Layout.Row>
            )}
          </form.AppField>

          {hasOrgWrite ? (
            <Flex gap="md" align="center" padding="sm">
              <form.Subscribe selector={state => !state.isPristine}>
                {hasChanged => (
                  <Flex
                    flex="1"
                    minWidth={0}
                    style={{visibility: hasChanged ? 'visible' : 'hidden'}}
                  >
                    <Alert variant="info">
                      {t('Only values captured after this change can be sealed.')}
                    </Alert>
                  </Flex>
                )}
              </form.Subscribe>
              <Flex gap="sm" flexShrink={0}>
                <Button onClick={() => form.reset()}>{t('Cancel')}</Button>
                <form.SubmitButton>{t('Save')}</form.SubmitButton>
              </Flex>
            </Flex>
          ) : null}
        </form.FieldGroup>
      </form.AppForm>
    </FormSearch>
  );
}
