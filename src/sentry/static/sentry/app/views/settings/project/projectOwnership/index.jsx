import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import OwnerInput from 'app/views/settings/project/projectOwnership/ownerInput';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

const CodeBlock = styled.pre`
  word-break: break-all;
  white-space: pre-wrap;
`;

class ProjectOwnership extends AsyncView {
  static propTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  getTitle() {
    return t('Ownership');
  }

  getEndpoints() {
    let {organization, project} = this.props;
    return [['ownership', `/projects/${organization.slug}/${project.slug}/ownership/`]];
  }

  renderBody() {
    let {project, organization} = this.props;
    let {ownership} = this.state;

    const disabled = !organization.access.includes('project:write');

    return (
      <div>
        <SettingsPageHeader title={t('Issue Owners')} />
        <PermissionAlert />
        <Panel>
          <PanelHeader>{t('Ownership Rules')}</PanelHeader>
          <PanelBody disablePadding={false}>
            <Block>
              {t(
                'Define rules here to configure automated ownership for new issues and direct email alerts'
              )}
            </Block>
            <Block>
              {t('Rules follow the pattern: ')}
              <code>type:glob owner owner</code>
            </Block>

            <Block>
              {tct(
                'Owners can be team identifiers starting with [pound], or user emails',
                {
                  pound: <code>#</code>,
                }
              )}
            </Block>

            <Block>
              {t('Globbing Syntax:')}
              <CodeBlock>
                {`* matches everything
? matches any single character`}
              </CodeBlock>
            </Block>

            <Block>
              {t('Examples:')}
              <CodeBlock>
                path:src/example/pipeline/* person@sentry.io #infrastructure
                {'\n'}
                url:http://example.com/settings/* #product
              </CodeBlock>
            </Block>
            <OwnerInput
              {...this.props}
              disabled={disabled}
              initialText={ownership.raw || ''}
            />
          </PanelBody>
        </Panel>

        <Form
          apiEndpoint={`/projects/${organization.slug}/${project.slug}/ownership/`}
          apiMethod="PUT"
          saveOnBlur
          initialData={{fallthrough: ownership.fallthrough}}
          hideFooter
        >
          <JsonForm
            forms={[
              {
                title: t('If ownership cannot be determined for an issue...'),
                fields: [
                  {
                    name: 'fallthrough',
                    type: 'boolean',
                    label: t('All users with access to this project are issue owners'),
                    help: t(
                      'Issue owners will receive notifications for issues they are responsible for.'
                    ),
                    disabled,
                  },
                ],
              },
            ]}
          />
        </Form>
      </div>
    );
  }
}

export default ProjectOwnership;

const Block = styled(TextBlock)`
  margin-bottom: 16px;
`;
