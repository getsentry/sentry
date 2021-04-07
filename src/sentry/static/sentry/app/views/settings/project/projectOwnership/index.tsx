import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t, tct} from 'app/locale';
import {Organization, Project} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import CodeOwners from 'app/views/settings/project/projectOwnership/codeowners';
import OwnerInput from 'app/views/settings/project/projectOwnership/ownerInput';

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
        <TextBlock>
          {tct(
            `Automatically assign issues and send alerts to the right people based on issue properties. To learn more about Issue Owners, [link:view the docs].`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/error-monitoring/issue-owners/" />
              ),
            }
          )}
        </TextBlock>
        <PermissionAlert />
        <Panel>
          <PanelHeader>{t('Ownership Rules')}</PanelHeader>
          <PanelBody withPadding>
            <Block>
              {t('An owner for an issue can be a team such as ')}{' '}
              <code>#infrastructure</code>
              {t('or a member’s email like ')} <code>tom@sentry.io</code>
              {'. Here are some examples: '}
            </Block>
            <Block>
              <CodeBlock>
                path:src/example/pipeline/* person@sentry.io #infrastructure
                {'\n'}
                url:http://example.com/settings/* #product
                {'\n'}
                tags.sku_class:enterprise #enterprise
                {'\n'}
                module:example.api.base tom@sentry.io
              </CodeBlock>
            </Block>
            <Block>
              {t('These rules follow the pattern: ')}
              <code>matcher:pattern owner1 owner2 ...</code>{' '}
              {t('and the globbing syntax works like this:')}
            </Block>
            <Block>
              <CodeBlock>
                {`* matches everything
? matches any single character`}
              </CodeBlock>
            </Block>
            <OwnerInput
              {...this.props}
              disabled={disabled}
              initialText={ownership.raw || ''}
            />
          </PanelBody>
        </Panel>
        <Feature features={['import-codeowners']}>
          <CodeOwners {...this.props} />
        </Feature>
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
`;
