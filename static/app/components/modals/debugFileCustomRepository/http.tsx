import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormValidators, ScrapsForm, useScrapsForm} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {
  DEBUG_SOURCE_CASINGS,
  DEBUG_SOURCE_LAYOUTS,
  DEBUG_SOURCE_TYPES,
} from 'sentry/data/debugFileSources';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tct} from 'sentry/locale';
import type {CustomRepoFormData, CustomRepoHttp} from 'sentry/types/debugFiles';
import {CustomRepoType} from 'sentry/types/debugFiles';
import {uniqueId} from 'sentry/utils/guid';

type SubmitData = Extract<CustomRepoFormData, {type: CustomRepoType.HTTP}>;

const LAYOUT_OPTIONS = Object.entries(DEBUG_SOURCE_LAYOUTS).map(([value, label]) => ({
  value,
  label,
}));

const CASING_OPTIONS = Object.entries(DEBUG_SOURCE_CASINGS).map(([value, label]) => ({
  value,
  label,
}));

const schema = z.object({
  id: z.string(),
  name: z.string().min(1, t('Name is required')),
  url: z
    .string()
    .min(1, t('Download Url is required'))
    .pipe(z.url(t('Enter a valid URL'))),
  username: z.string().optional(),
  // `undefined` means the previously stored password should be kept untouched.
  password: z.string().optional(),
  layoutType: z.string(),
  layoutCasing: z.string(),
});

type Props = Pick<ModalRenderProps, 'Header' | 'Body' | 'Footer'> & {
  onSubmit: (data: SubmitData) => Promise<void>;
  initialData?: CustomRepoHttp;
};

export function Http({Header, Body, Footer, onSubmit, initialData}: Props) {
  const isEditing = !!initialData;
  const {id, name, url, username, password, layout, ...preservedConfig} =
    initialData ?? {};

  const defaultValues: z.input<typeof schema> = {
    id: id ?? uniqueId(),
    name: name ?? '',
    url: url ?? '',
    username: username ?? '',
    // When editing a repository with a stored password we start with
    // `undefined` to represent "unchanged".
    password: typeof password === 'object' ? undefined : '',
    layoutType: layout?.type ?? 'native',
    layoutCasing: layout?.casing ?? 'default',
  };

  const form = useScrapsForm({
    defaultValues,
    validators: defaultFormValidators(schema),
    onSubmit: ({value}) => {
      const parsedValue = schema.parse(value);
      return onSubmit({
        ...preservedConfig,
        id: parsedValue.id,
        name: parsedValue.name,
        url: parsedValue.url,
        ...(parsedValue.username ? {username: parsedValue.username} : {}),
        type: CustomRepoType.HTTP,
        'layout.type': parsedValue.layoutType,
        'layout.casing': parsedValue.layoutCasing,
        password:
          parsedValue.password === undefined
            ? {'hidden-secret': true}
            : parsedValue.password
              ? parsedValue.password
              : undefined,
      });
    },
  });

  return (
    <ScrapsForm form={form}>
      <Header closeButton>
        {isEditing
          ? tct('Update [name] Repository', {name: DEBUG_SOURCE_TYPES.http})
          : tct('Add [name] Repository', {name: DEBUG_SOURCE_TYPES.http})}
      </Header>
      <Body>
        <Stack gap="xl">
          <form.Field name="name">
            {field => (
              <field.Layout.Stack
                label={t('Name')}
                hintText={t('A display name for this repository')}
                required
              >
                <field.Input
                  value={field.value}
                  onChange={field.handleChange}
                  placeholder={t('New Repository')}
                />
              </field.Layout.Stack>
            )}
          </form.Field>
          <form.Field name="url">
            {field => (
              <field.Layout.Stack
                label={t('Download Url')}
                hintText={t('Full URL to the symbol server')}
                required
              >
                <field.Input
                  value={field.value}
                  onChange={field.handleChange}
                  placeholder="https://msdl.microsoft.com/download/symbols/"
                />
              </field.Layout.Stack>
            )}
          </form.Field>
          <form.Field name="username">
            {field => (
              <field.Layout.Stack
                label={t('User')}
                hintText={t('User for HTTP basic auth')}
              >
                <field.Input
                  value={field.value ?? ''}
                  onChange={field.handleChange}
                  placeholder="admin"
                />
              </field.Layout.Stack>
            )}
          </form.Field>
          <form.Field name="password">
            {field => {
              const isUnchanged = field.value === undefined;
              const showClearButton = isUnchanged || !!field.value;
              return (
                <field.Layout.Stack
                  label={t('Password')}
                  hintText={t('Password for HTTP basic auth')}
                >
                  <field.Input
                    type={isUnchanged ? 'text' : 'password'}
                    placeholder={isUnchanged ? t('(Password unchanged)') : 'open-sesame'}
                    value={field.value ?? ''}
                    onChange={field.handleChange}
                    trailingItems={
                      showClearButton ? (
                        <Button
                          size="xs"
                          variant="transparent"
                          icon={<IconClose size="xs" />}
                          aria-label={t('Clear password')}
                          onClick={() => field.handleChange('')}
                        />
                      ) : undefined
                    }
                  />
                </field.Layout.Stack>
              );
            }}
          </form.Field>
          <form.Field name="layoutType">
            {field => (
              <field.Layout.Stack
                label={t('Directory Layout')}
                hintText={t('The layout of the folder structure.')}
              >
                <field.Select
                  value={field.value}
                  onChange={field.handleChange}
                  options={LAYOUT_OPTIONS}
                />
              </field.Layout.Stack>
            )}
          </form.Field>
          <form.Field name="layoutCasing">
            {field => (
              <field.Layout.Stack
                label={t('Path Casing')}
                hintText={t('The case of files and folders.')}
              >
                <field.Select
                  value={field.value}
                  onChange={field.handleChange}
                  options={CASING_OPTIONS}
                />
              </field.Layout.Stack>
            )}
          </form.Field>
        </Stack>
      </Body>
      <Footer>
        <form.SubmitButton>{t('Save changes')}</form.SubmitButton>
      </Footer>
    </ScrapsForm>
  );
}
