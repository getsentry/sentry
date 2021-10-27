import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import ProjectActions from 'app/actions/projectActions';
import {Client} from 'app/api';
import Access from 'app/components/acl/access';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import {BuiltinSymbolSource} from 'app/types/debugFiles';
import SelectField from 'app/views/settings/components/forms/selectField';

type Props = {
  api: Client;
  organization: Organization;
  projSlug: Project['slug'];
  builtinSymbolSourceOptions: BuiltinSymbolSource[];
  builtinSymbolSources: string[];
};

function BuiltInRepositories({
  api,
  organization,
  builtinSymbolSourceOptions,
  builtinSymbolSources,
  projSlug,
}: Props) {
  // If the project details object has an unknown built-in source, this will be filtered here.
  // This prevents the UI from showing the wrong feedback message when updating the field
  const validBuiltInSymbolSources = builtinSymbolSources.filter(builtinSymbolSource =>
    builtinSymbolSourceOptions.find(({sentry_key}) => sentry_key === builtinSymbolSource)
  );

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

  async function handleChange(value: null | string[]) {
    const {successMessage, errorMessage} = getRequestMessages((value ?? []).length);

    try {
      const updatedProjectDetails: Project = await api.requestPromise(
        `/projects/${organization.slug}/${projSlug}/`,
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
    <Panel>
      <PanelHeader>{t('Built-in Repositories')}</PanelHeader>
      <PanelBody>
        <Access access={['project:write']}>
          {({hasAccess}) => (
            <StyledSelectField
              disabled={!hasAccess}
              name="builtinSymbolSources"
              label={t('Built-in Repositories')}
              help={t(
                'Configures which built-in repositories Sentry should use to resolve debug files.'
              )}
              placeholder={t('Select built-in repository')}
              value={validBuiltInSymbolSources}
              onChange={handleChange}
              options={builtinSymbolSourceOptions
                .filter(source => !source.hidden)
                .map(source => ({
                  value: source.sentry_key,
                  label: source.name,
                }))}
              getValue={value => (value === null ? [] : value)}
              flexibleControlStateSize
              multiple
            />
          )}
        </Access>
      </PanelBody>
    </Panel>
  );
}

export default BuiltInRepositories;

const StyledSelectField = styled(SelectField)`
  ${p => p.disabled && `cursor: not-allowed`}
`;
