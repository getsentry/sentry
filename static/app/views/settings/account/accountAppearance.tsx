import {Fragment} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';

import {updateUser} from 'sentry/actionCreators/account';
import {NotFound} from 'sentry/components/errors/notFound';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {removeBodyTheme} from 'sentry/utils/removeBodyTheme';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {THEME_OPTIONS, themeSchema} from './accountDetails';

const appearanceSchema = z.object({
  theme: themeSchema,
});

const themeMutationOptions = mutationOptions({
  mutationFn: (options: Partial<User['options']>) => {
    return fetchMutation<User>({
      method: 'PUT',
      url: getApiUrl('/users/$userId/', {path: {userId: 'me'}}),
      data: {options},
    });
  },
  onSuccess: user => {
    updateUser(user);
    removeBodyTheme();
  },
});

function AccountAppearance() {
  const organization = useOrganization({allowNull: true});
  const user = useUser();

  if (!organization?.features.includes('theme-variants')) {
    return <NotFound />;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Appearance')} />
      <SettingsPageHeader title={t('Appearance')} />
      <FieldGroup title={t('Color scheme')}>
        <AutoSaveForm
          name="theme"
          schema={appearanceSchema}
          initialValue={user.options.theme}
          mutationOptions={themeMutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('Theme')}
              hintText={t('Use light or dark mode, or match your system setting.')}
            >
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={THEME_OPTIONS}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      </FieldGroup>
    </Fragment>
  );
}

export default AccountAppearance;
