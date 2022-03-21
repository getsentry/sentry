import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import ProjectActions from 'sentry/actions/projectActions';
import {Client} from 'sentry/api';
import Access from 'sentry/components/acl/access';
import SelectField from 'sentry/components/forms/selectField';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {BuiltinSymbolSource} from 'sentry/types/debugFiles';

const SECTION_TITLE = t('Built-in Repositories');

type Props = {
  api: Client;
  builtinSymbolSourceOptions: BuiltinSymbolSource[];
  builtinSymbolSources: string[];
  isLoading: boolean;
  organization: Organization;
  projSlug: Project['slug'];
};

function BuiltInRepositories({
  api,
  organization,
  builtinSymbolSourceOptions,
  builtinSymbolSources,
  projSlug,
  isLoading,
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
      <PanelHeader>{SECTION_TITLE}</PanelHeader>
      <PanelBody>
        {isLoading ? (
          <LoadingIndicator />
        ) : (
          <Access access={['project:write']}>
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
                getValue={value => (value === null ? [] : value)}
                flexibleControlStateSize
                multiple
              />
            )}
          </Access>
        )}
      </PanelBody>
    </Panel>
  );
}

export default BuiltInRepositories;

const StyledSelectField = styled(SelectField)`
  ${p => p.disabled && `cursor: not-allowed`}
`;
