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
  builtinSymbolSourceOptions: BuiltinSymbolSource[];
  builtinSymbolSources: string[];
};

function BuildInSymbolSources({
  api,
  organization,
  builtinSymbolSourceOptions,
  builtinSymbolSources,
  projectSlug,
}: Props) {
  function getRequestMessages(builtinSymbolSourcesQuantity: number) {
    if (builtinSymbolSourcesQuantity > builtinSymbolSources.length) {
      return {
        successMessage: t('Successfully added built-in repository'),
        errorMessage: t('An error occured while adding new built-in repository'),
      };
    }

    return {
      successMessage: t('Successfully removed built-in repository'),
      errorMessage: t('An error occured while removing built-in repository'),
    };
  }

  async function handleChange(value: string[]) {
    const {successMessage, errorMessage} = getRequestMessages(value.length);

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
      addSuccessMessage(successMessage);
    } catch {
      addErrorMessage(errorMessage);
    }
  }

  return (
    <SelectField
      name="builtinSymbolSources"
      label={t('Built-in Repositories')}
      help={t(
        'Configures which built-in repositories Sentry should use to resolve debug files.'
      )}
      value={builtinSymbolSources}
      onChange={handleChange}
      choices={
        builtinSymbolSourceOptions
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
