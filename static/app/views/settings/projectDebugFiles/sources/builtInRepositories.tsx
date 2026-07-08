import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {BuiltinSymbolSource} from 'sentry/types/debugFiles';
import type {Organization} from 'sentry/types/organization';
import type {DetailedProject, Project} from 'sentry/types/project';
import {makeDetailedProjectQueryKey} from 'sentry/utils/project/useDetailedProject';
import {fetchMutation} from 'sentry/utils/queryClient';

const SECTION_TITLE = t('Built-in Repositories');

const schema = z.object({
  builtinSymbolSources: z.array(z.string()),
});

type Props = {
  builtinSymbolSourceOptions: BuiltinSymbolSource[];
  builtinSymbolSources: string[];
  organization: Organization;
  project: Project;
};

export function BuiltInRepositories({
  organization,
  builtinSymbolSourceOptions,
  builtinSymbolSources,
  project,
}: Props) {
  const queryClient = useQueryClient();
  const projectQueryKey = makeDetailedProjectQueryKey({
    orgSlug: organization.slug,
    projectSlug: project.slug,
  });

  // If the project details object has an unknown built-in source, this will be filtered here.
  // This prevents the UI from showing the wrong feedback message when updating the field
  const validBuiltInSymbolSources = builtinSymbolSources.filter(builtinSymbolSource =>
    builtinSymbolSourceOptions.find(({sentry_key}) => sentry_key === builtinSymbolSource)
  );

  const hasAccess = hasEveryAccess(['project:write'], {organization, project});

  function getRequestMessages(builtinSymbolSourcesQuantity: number) {
    if (builtinSymbolSourcesQuantity === 0) {
      return {
        errorMessage: t('This field requires at least one built-in repository'),
      };
    }

    if (builtinSymbolSourcesQuantity > validBuiltInSymbolSources.length) {
      return {
        successMessage: t('Successfully added built-in repository'),
        errorMessage: t('An error occurred while adding new built-in repository'),
      };
    }

    return {
      successMessage: t('Successfully removed built-in repository'),
      errorMessage: t('An error occurred while removing built-in repository'),
    };
  }

  const options = builtinSymbolSourceOptions
    .filter(source => !source.hidden)
    .map(source => ({
      value: source.sentry_key,
      label: source.name,
    }));

  return (
    <FieldGroup title={SECTION_TITLE}>
      <AutoSaveForm
        name="builtinSymbolSources"
        schema={schema}
        initialValue={validBuiltInSymbolSources}
        mutationOptions={{
          mutationFn: (data: Partial<DetailedProject>) =>
            fetchMutation<DetailedProject>({
              url: `/projects/${organization.slug}/${project.slug}/`,
              method: 'PUT',
              data,
            }),
          onSuccess: (response, variables) => {
            ProjectsStore.onUpdateSuccess(response);
            queryClient.setQueryData(projectQueryKey, prev => ({
              headers: prev?.headers ?? {},
              json: response,
            }));
            const {successMessage} = getRequestMessages(
              variables.builtinSymbolSources.length
            );
            if (successMessage) {
              addSuccessMessage(successMessage);
            }
          },
          onError: (_error, variables) => {
            const {errorMessage} = getRequestMessages(
              variables.builtinSymbolSources.length
            );
            addErrorMessage(errorMessage);
          },
        }}
      >
        {field => (
          <field.Layout.Row
            label={SECTION_TITLE}
            hintText={t(
              'Configures which built-in repositories Sentry should use to resolve debug files.'
            )}
          >
            <field.Select
              multiple
              name="builtinSymbolSources"
              value={field.state.value}
              onChange={field.handleChange}
              options={options}
              placeholder={t('Select built-in repository')}
              disabled={
                hasAccess
                  ? false
                  : t(
                      'You do not have permission to edit built-in repositories configurations.'
                    )
              }
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}
