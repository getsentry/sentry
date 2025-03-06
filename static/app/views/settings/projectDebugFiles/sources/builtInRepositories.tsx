import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import Access from 'sentry/components/acl/access';
import SelectField from 'sentry/components/forms/fields/selectField';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {BuiltinSymbolSource} from 'sentry/types/debugFiles';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

const SECTION_TITLE = t('Built-in Repositories');

type Props = {
  api: Client;
  builtinSymbolSourceOptions: BuiltinSymbolSource[];
  builtinSymbolSources: string[];
  organization: Organization;
  project: Project;
};

function BuiltInRepositories({
  api,
  organization,
  builtinSymbolSourceOptions,
  builtinSymbolSources,
  project,
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
        `/projects/${organization.slug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {
            builtinSymbolSources: value,
          },
        }
      );

      ProjectsStore.onUpdateSuccess(updatedProjectDetails);
      addSuccessMessage(successMessage);
    } catch {
      addErrorMessage(errorMessage);
    }
  }

  return (
    <Panel>
      <PanelHeader>{SECTION_TITLE}</PanelHeader>
      <PanelBody>
        <Access access={['project:write']} project={project}>
          {({hasAccess}) => (
            <StyledSelectField
              disabledReason={
                !hasAccess
                  ? t(
                      'You do not have permission to edit built-in repositories configurations.'
                    )
                  : undefined
              }
              disabled={!hasAccess}
              name="builtinSymbolSources"
              label={SECTION_TITLE}
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
              getValue={(value: any) => (value === null ? [] : value)}
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
