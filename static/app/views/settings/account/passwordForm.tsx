import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, FormSearch, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useUser} from 'sentry/utils/useUser';

const schema = z
  .object({
    password: z.string().min(1, t('Current password is required')),
    passwordNew: z.string().min(1, t('New password is required')),
    passwordVerify: z.string().min(1, t('Please verify your new password')),
  })
  .refine(data => data.passwordNew === data.passwordVerify, {
    message: t('Passwords do not match'),
    path: ['passwordVerify'],
  });

export function PasswordForm() {
  const user = useUser();

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof schema>) =>
      fetchMutation({
        url: '/users/me/password/',
        method: 'PUT',
        data,
      }),
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      password: '',
      passwordNew: '',
      passwordVerify: '',
    },
    validators: {
      onDynamic: schema,
    },
    onSubmit: ({value, formApi}) => {
      return mutation
        .mutateAsync(value)
        .then(() => {
          formApi.reset();
          addSuccessMessage(t('Password has been changed'));
        })
        .catch(() => {
          addErrorMessage(t('Error changing password'));
        });
    },
  });

  if (user.isManaged) {
    return null;
  }

  return (
    <FormSearch route="/settings/account/security/">
      <form.AppForm>
        <form.FormWrapper>
          <form.FieldGroup title={t('Password')}>
            <Alert variant="info" system>
              {t('Changing your password will invalidate all logged in sessions.')}
            </Alert>
            <form.AppField name="password">
              {field => (
                <field.Layout.Row label={t('Current Password')} required>
                  <field.Password
                    autoComplete="current-password"
                    value={field.state.value}
                    onChange={field.handleChange}
                    placeholder={t('Your current password')}
                  />
                </field.Layout.Row>
              )}
            </form.AppField>
            <form.AppField name="passwordNew">
              {field => (
                <field.Layout.Row label={t('New Password')} required>
                  <field.Password
                    autoComplete="new-password"
                    value={field.state.value}
                    onChange={field.handleChange}
                    placeholder={t('Your new password')}
                  />
                </field.Layout.Row>
              )}
            </form.AppField>
            <form.AppField name="passwordVerify">
              {field => (
                <field.Layout.Row
                  label={t('Verify New Password')}
                  hintText={t('Verify your new password')}
                  required
                >
                  <field.Password
                    autoComplete="new-password"
                    value={field.state.value}
                    onChange={field.handleChange}
                    placeholder={t('Verify your new password')}
                  />
                </field.Layout.Row>
              )}
            </form.AppField>
            <Flex justify="end">
              <form.SubmitButton>{t('Change password')}</form.SubmitButton>
            </Flex>
          </form.FieldGroup>
        </form.FormWrapper>
      </form.AppForm>
    </FormSearch>
  );
}
