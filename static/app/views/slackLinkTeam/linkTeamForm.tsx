import {skipToken, useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, useScrapsForm, useStore} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {OrganizationSummary, Team} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

const schema = z.object({
  organization: z
    .string()
    .nullable()
    .refine(value => value !== null, t('Select an organization')),
  team: z
    .string()
    .nullable()
    .refine(value => value !== null, t('Select a team')),
});

interface LinkTeamFormProps {
  organizations: OrganizationSummary[];
  signedParams: string;
}

export function LinkTeamForm({organizations, signedParams}: LinkTeamFormProps) {
  const defaultValues: z.input<typeof schema> = {
    organization: organizations.length === 1 ? organizations[0]!.slug : null,
    team: null,
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
  });

  const selectedSlug = useStore(form.store, state => state.values.organization);
  const selectedOrganization = organizations.find(org => org.slug === selectedSlug);

  const {data: teams, isFetching: isFetchingTeams} = useQuery({
    ...apiOptions.as<Team[]>()(
      '/organizations/$organizationIdOrSlug/slack/link-team/$signedParams/',
      {
        path: selectedOrganization
          ? {organizationIdOrSlug: selectedOrganization.slug, signedParams}
          : skipToken,
        host: selectedOrganization?.links.regionUrl,
        staleTime: 0,
      }
    ),
    retry: false,
  });

  const hasNoTeams = teams !== undefined && teams.length === 0;

  return (
    <form.AppForm form={form}>
      <Stack gap="xl">
        <form.AppField
          name="organization"
          listeners={{onChange: () => form.setFieldValue('team', null)}}
        >
          {field => (
            <field.Layout.Stack label={t('Organization')} required>
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={organizations.map(org => ({
                  label: org.name,
                  value: org.slug,
                }))}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        <form.AppField name="team">
          {field => (
            <field.Layout.Stack label={t('Team')} required>
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                disabled={!selectedOrganization || isFetchingTeams || hasNoTeams}
                options={(teams ?? []).map(team => ({
                  label: `#${team.slug}`,
                  value: team.id,
                }))}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        {hasNoTeams && (
          <Alert variant="warning">
            {t(
              'You can only link teams you are a team admin of, unless you are an organization owner, manager, or admin.'
            )}
          </Alert>
        )}
      </Stack>
    </form.AppForm>
  );
}
