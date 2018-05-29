import React from 'react';
import styled from 'react-emotion';

import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import SentryTypes from 'app/proptypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import OwnerInput from 'app/views/settings/project/projectOwnership/ownerInput';

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
    return [
      ['project', `/projects/${organization.slug}/${project.slug}/`],
      ['ownership', `/projects/${organization.slug}/${project.slug}/ownership/`],
    ];
  }

  renderBody() {
    let {project, organization} = this.props;
    let {ownership} = this.state;

    return (
      <div>
        <SettingsPageHeader title={t('Issue Owners')} />

        <div className="alert alert-block alert-info">
          {t(`Psst! This feature is still a work-in-progress. Thanks for being an early
          adopter!`)}
        </div>

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
            <OwnerInput {...this.props} initialText={ownership.raw || ''} />
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
                    label: t('All users with access to this project are owners'),
                    help: t(
                      'Owners will receive notifications for issues they are responsible for.'
                    ),
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
