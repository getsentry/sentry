import React from 'react';
import styled from '@emotion/styled';
import {RouteComponentProps} from 'react-router/lib/Router';

import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import OwnerInput from 'app/views/settings/project/projectOwnership/ownerInput';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import Button from 'app/components/button';
import {Organization, Project} from 'app/types';

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<{orgId: string; projectId: string}, {}>;

type State = {
  ownership: null | any;
} & AsyncView['state'];

class ProjectOwnership extends AsyncView<Props, State> {
  getTitle() {
    const {project} = this.props;
    return routeTitleGen(t('Issue Owners'), project.slug, false);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, project} = this.props;
    return [['ownership', `/projects/${organization.slug}/${project.slug}/ownership/`]];
  }

  renderBody() {
    const {project, organization} = this.props;
    const {ownership} = this.state;

    const disabled = !organization.access.includes('project:write');

    return (
      <React.Fragment>
        <SettingsPageHeader
          title={t('Issue Owners')}
          action={
            <Button
              to={{
                pathname: `/organizations/${organization.slug}/issues/`,
                query: {project: project.id},
              }}
              size="small"
            >
              {t('View Issues')}
            </Button>
          }
        />
        <PermissionAlert />
        <Panel>
          <PanelHeader>{t('Ownership Rules')}</PanelHeader>
          <PanelBody withPadding>
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
                {'\n'}
                tags.sku_class:enterprise #enterprise
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

        <Form
          apiEndpoint={`/projects/${organization.slug}/${project.slug}/ownership/`}
          apiMethod="PUT"
          saveOnBlur
          initialData={{autoAssignment: ownership.autoAssignment}}
          hideFooter
        >
          <JsonForm
            forms={[
              {
                title: t('If a new event matches any of the ownership rules...'),
                fields: [
                  {
                    name: 'autoAssignment',
                    type: 'boolean',
                    label: t('The issue is assigned to the team or user'),
                    help: t('Issue owners will be automatically assigned.'),
                    disabled,
                  },
                ],
              },
            ]}
          />
        </Form>
      </React.Fragment>
    );
  }
}

export default ProjectOwnership;

const Block = styled(TextBlock)`
  margin-bottom: 16px;
`;

const CodeBlock = styled('pre')`
  word-break: break-all;
  white-space: pre-wrap;
  background-color: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};
`;
