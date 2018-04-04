import React from 'react';
import styled from 'react-emotion';

import {t} from '../../../../locale';
import AsyncView from '../../../asyncView';

import {Panel, PanelBody, PanelHeader} from '../../../../components/panels';
import SentryTypes from '../../../../proptypes';
import SettingsPageHeader from '../../components/settingsPageHeader';
import Form from '../../components/forms/form';
import JsonForm from '../../components/forms/jsonForm';
import OwnerInput from './ownerInput';

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
        <SettingsPageHeader title={t('Issue Ownership')} />

        <div className="alert alert-block alert-info">
          {t(`Psst! This feature is still a work-in-progress. Thanks for being an early
          adopter!`)}
        </div>

        <Panel>
          <PanelHeader>{t('Ownership Rules')}</PanelHeader>
          <PanelBody disablePadding={false}>
            <p>
              {t(
                'Define rules here to configure automated ownership for new issues and direct email alerts'
              )}
            </p>
            <p>{t('Rules follow the pattern type:glob owner owner')}</p>
            <p>
              {t(
                'Owners can be team identifiers starting with #, or user emails (use @ to input from list)'
              )}
            </p>
            <p>
              {t('Globbing Syntax:')}
              <pre>
                {`* matches everything
? matches any single character
[seq] matches any
[!seq] matches any character not in seq`}
              </pre>
            </p>
            Examples:
            <CodeBlock>
              path:src/example/pipeline/* person@sentry.io #infrastructure
              {'\n'}
              url:http://example.com/settings/* #product
            </CodeBlock>
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
                title: 'Default Ownership',
                fields: [
                  {
                    name: 'fallthrough',
                    type: 'boolean',
                    label: 'Default Owner is everyone',
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
