import {skipToken, useInfiniteQuery, useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {defaultFormOptions, useScrapsForm, useStore} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';

import type {LinkResult, LinkTeamOrganization} from './types';

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
  onLinked: (result: LinkResult) => void;
  organizations: LinkTeamOrganization[];
  signedParams: string;
}

export function LinkTeamForm({organizations, signedParams, onLinked}: LinkTeamFormProps) {
  const defaultValues: z.input<typeof schema> = {
    organization: organizations.length === 1 ? (organizations[0]?.slug ?? null) : null,
    team: null,
  };

  const linkTeam = useMutation({
    mutationFn: async ({
      organization,
      team,
    }: {
      organization: LinkTeamOrganization;
      team: Team;
    }): Promise<LinkResult> => {
      try {
        await fetchMutation({
          method: 'POST',
          url: getApiUrl(
            '/organizations/$organizationIdOrSlug/slack/link-team/$signedParams/',
            {path: {organizationIdOrSlug: organization.slug, signedParams}}
          ),
          data: {team: team.id},
          options: {host: organization.links.regionUrl},
        });
      } catch (error) {
        if (error instanceof RequestError && error.status === 409) {
          return {
            kind: 'alreadyLinked',
            detail: getRequestErrorUserMessage(error),
          };
        }

        throw error;
      }

      return {kind: 'linked', team};
    },
    onSuccess: onLinked,
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      const parsed = schema.parse(value);
      const organization = organizations.find(org => org.slug === parsed.organization);
      const team = teams?.find(item => item.id === parsed.team);

      if (!organization || !team) {
        return Promise.resolve();
      }

      return linkTeam.mutateAsync({organization, team}).catch(() => {});
    },
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
          listeners={{
            onChange: () => {
              form.setFieldValue('team', null);
              linkTeam.reset();
            },
          }}
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
        <form.AppField name="team" listeners={{onChange: () => linkTeam.reset()}}>
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
        {linkTeam.isError && (
          <Alert variant="danger">{getRequestErrorUserMessage(linkTeam.error)}</Alert>
        )}
        <Flex justify="end" borderTop="secondary" paddingTop="xl">
          <form.SubmitButton
            disabled={
              selectedOrganization !== undefined &&
              (teams === undefined || isTeamsError || hasNoTeams)
            }
          >
            {t('Link Team')}
          </form.SubmitButton>
        </Flex>
      </Stack>
    </form.AppForm>
  );
}
