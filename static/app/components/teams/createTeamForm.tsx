import {Fragment} from 'react';
import {z} from 'zod';

import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import {slugify} from 'sentry/utils/slugify';

type Payload = {
  slug: string;
};

type Props = {
  onSubmit: (data: Payload) => Promise<Team | void> | Team | void;
};

const schema = z.object({
  slug: z.string().min(1, t('Slug is required')),
});

export function CreateTeamForm({onSubmit}: Props) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {slug: ''},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => Promise.resolve(onSubmit(value)).catch(() => {}),
  });

  return (
    <Fragment>
      <p>
        {t('Teams group members for issue assignment, ownership, and notifications.')}
      </p>
      <form.AppForm form={form}>
        <form.AppField name="slug">
          {field => (
            <field.Layout.Stack
              label={t('Team Slug')}
              hintText={t('Use lowercase letters, numbers, dashes, and underscores.')}
              required
            >
              <field.Input
                value={field.state.value}
                onChange={value => field.handleChange(slugify(value))}
                placeholder={t('e.g. operations, web-frontend, mobile-ios')}
                autoFocus
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <Flex justify="end" padding="md 0 0 0">
          <form.SubmitButton>{t('Create Team')}</form.SubmitButton>
        </Flex>
      </form.AppForm>
    </Fragment>
  );
}
