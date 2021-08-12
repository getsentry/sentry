import {Fragment} from 'react';

import {addErrorMessage} from 'app/actionCreators/indicator';
import Button from 'app/components/button';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import {Integration, Organization} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Form from 'app/views/settings/components/forms/form';
import InputField from 'app/views/settings/components/forms/inputField';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import PermissionAlert from 'app/views/settings/organization/permissionAlert';

type Props = {
  organization: Organization;
} & AsyncView['props'];

type State = {
  integrations: Integration[];
} & AsyncView['state'];

class OrganizationGitManager extends AsyncView<Props, State> {
  getTitle() {
    const {organization} = this.props;
    return routeTitleGen(t('Git Manager'), organization.slug, false);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization} = this.props;
    return [
      [
        'integrations',
        `/organizations/${organization.slug}/integrations/`,
        {query: {includeConfig: 0}},
      ],
    ];
  }

  renderBody() {
    const {organization} = this.props;
    const {integrations} = this.state;

    const hasGitIntegrations = integrations.some(integration =>
      integration.provider.features.includes('commits')
    );

    return (
      <Fragment>
        <SettingsPageHeader title={t('Git Manager')} />
        <PermissionAlert />
        <TextBlock>
          {t(
            'If the format from the Git Manager doesn’t fit with your branch naming conventions, you can customize it as long as [issueId] is included in the branch name.'
          )}
        </TextBlock>
        <Panel>
          <PanelHeader>
            <div>{t('Git Manager')}</div>
          </PanelHeader>
          <PanelBody>
            {!hasGitIntegrations ? (
              <EmptyMessage
                title={t('No Git integrations have been setup yet!')}
                description={t(
                  'But that doesn’t have to be the case for long! Add an integration to get started.'
                )}
                action={
                  <Button
                    priority="primary"
                    size="small"
                    to={`/settings/${organization.slug}/integrations/?category=source%20code%20management`}
                  >
                    {t('Add integration')}
                  </Button>
                }
              />
            ) : (
              <Form
                apiMethod="PUT"
                apiEndpoint={`/organizations/${organization.slug}/`}
                saveOnBlur
                allowUndo
                initialData={{branchFormat: organization.branchFormat}}
                onSubmitError={() => addErrorMessage('Unable to save change')}
              >
                <InputField
                  name="branchFormat"
                  label={t('Branch format')}
                  help={t(
                    'Customize the default branch format in the Git Manager. This setting applies to all users of this organization.'
                  )}
                  placeholder="e.g. fix/[issueType]-[issueId]"
                />
              </Form>
            )}
          </PanelBody>
        </Panel>
      </Fragment>
    );
  }
}

export default withOrganization(OrganizationGitManager);
