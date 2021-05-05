import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import ProjectActions from 'app/actions/projectActions';
import {Client} from 'app/api';
import {t} from 'app/locale';
import {Choices, Organization, Project} from 'app/types';
import {BuiltinSymbolSource} from 'app/types/debugFiles';
import SelectField from 'app/views/settings/components/forms/selectField';

type Props = {
  api: Client;
  organization: Organization;
  projectSlug: Project['slug'];
  builtinSymbolSources: BuiltinSymbolSource[];
};

function BuildInSymbolSources({
  api,
  organization,
  builtinSymbolSources,
  projectSlug,
}: Props) {
  async function handleChange(value: string[]) {
    try {
      const updatedProjectDetails: Project = await api.requestPromise(
        `/projects/${organization.slug}/${projectSlug}/`,
        {
          method: 'PUT',
          data: {
            builtinSymbolSources: value,
          },
        }
      );

      ProjectActions.updateSuccess(updatedProjectDetails);
      addSuccessMessage(t('Successfully updated built-in repositories'));
    } catch {
      addErrorMessage(t('An error occured while updating built-in repositories'));
    }
  }

  return (
    <SelectField
      name="builtinSymbolSources"
      label={t('Built-in Repositories')}
      help={t(
        'Configures which built-in repositories Sentry should use to resolve debug files.'
      )}
      onChange={handleChange}
      formatMessageValue={value => {
        const rv: string[] = [];
        value.forEach(key => {
          builtinSymbolSources.forEach(source => {
            if (source.sentry_key === key) {
              rv.push(source.name);
            }
          });
        });
        return rv.length ? rv.join(', ') : '\u2014';
      }}
      choices={
        builtinSymbolSources
          ?.filter(source => !source.hidden)
          .map(source => [source.sentry_key, t(source.name)]) as Choices
      }
      getValue={value => (value === null ? [] : value)}
      flexibleControlStateSize
      multiple
    />
  );
}

export default BuildInSymbolSources;
