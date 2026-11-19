import {skipToken, useInfiniteQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, useScrapsForm, useStore} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';

import type {LinkTeamOrganization} from './types';

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
  organizations: LinkTeamOrganization[];
  signedParams: string;
}

export function LinkTeamForm({organizations, signedParams}: LinkTeamFormProps) {
  const defaultValues: z.input<typeof schema> = {
    organization: organizations.length === 1 ? (organizations[0]?.slug ?? null) : null,
    team: null,
  };

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
  });

  const selectedSlug = useStore(form.store, state => state.values.organization);
  const selectedOrganization = organizations.find(org => org.slug === selectedSlug);

  const teamsQuery = useInfiniteQuery({
    ...apiOptions.asInfinite<Team[]>()(
      '/organizations/$organizationIdOrSlug/slack/link-team/$signedParams/',
      {
        path: selectedOrganization
          ? {organizationIdOrSlug: selectedOrganization.slug, signedParams}
          : skipToken,
        host: selectedOrganization?.links.regionUrl,
        staleTime: 0,
      }
    ),
    select: ({pages}) => pages.flatMap(page => page.json),
    retry: false,
  });
  useFetchAllPages({result: teamsQuery});
  const {
    data: teams,
    isFetching: isFetchingTeams,
    isError: isTeamsError,
    error: teamsError,
  } = teamsQuery;

  const hasNoTeams = teams?.length === 0;

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
                isLoading={isFetchingTeams}
                disabled={teams === undefined || isTeamsError || hasNoTeams}
                options={(teams ?? []).map(team => ({
                  label: `#${team.slug}`,
                  value: team.id,
                }))}
              />
            </field.Layout.Stack>
          )}
        </form.AppField>
        {isTeamsError && (
          <Alert variant="danger">{getRequestErrorUserMessage(teamsError)}</Alert>
        )}
        {hasNoTeams && (
          <Alert variant="warning">
            {t(
              "You don't have any teams you can link in this organization. You need to be on a team to link it, and unless you're an organization owner, manager, or admin, you also need to be its team admin."
            )}
          </Alert>
        )}
      </Stack>
    </form.AppForm>
  );
}
