import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {openEditOwnershipRules, openModal} from 'sentry/actionCreators/modal';
import Access from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {CodeOwner, IssueOwnership, Organization, Project} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';
import AddCodeOwnerModal from 'sentry/views/settings/project/projectOwnership/addCodeOwnerModal';
import {CodeOwnerErrors} from 'sentry/views/settings/project/projectOwnership/codeownerErrors';
import {CodeOwnerFileTable} from 'sentry/views/settings/project/projectOwnership/codeOwnerFileTable';
import CodeOwnersPanel from 'sentry/views/settings/project/projectOwnership/codeowners';
import {OwnershipRulesTable} from 'sentry/views/settings/project/projectOwnership/ownshipRulesTable';
import RulesPanel from 'sentry/views/settings/project/projectOwnership/rulesPanel';

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<{projectId: string}, {}>;

type State = {
  codeowners?: CodeOwner[];
  ownership?: null | IssueOwnership;
} & AsyncView['state'];

class ProjectOwnership extends AsyncView<Props, State> {
  // TODO: Remove with `streamline-targeting-context`
  getOwnershipTitle() {
    const {organization} = this.props;
    return organization.features?.includes('streamline-targeting-context')
      ? t('Ownership Rules')
      : t('Issue Owners');
  }

  getTitle() {
    const {project} = this.props;
    return routeTitleGen(this.getOwnershipTitle(), project.slug, false);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, project} = this.props;
    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      ['ownership', `/projects/${organization.slug}/${project.slug}/ownership/`],
    ];
    if (organization.features.includes('integrations-codeowners')) {
      endpoints.push([
        'codeowners',
        `/projects/${organization.slug}/${project.slug}/codeowners/`,
        {query: {expand: ['codeMapping', 'ownershipSyntax']}},
      ]);
    }
    return endpoints;
  }

  handleAddCodeOwner = () => {
    openModal(modalProps => (
      <AddCodeOwnerModal
        {...modalProps}
        organization={this.props.organization}
        project={this.props.project}
        onSave={this.handleCodeOwnerAdded}
      />
    ));
  };

  getPlaceholder() {
    return `#example usage
path:src/example/pipeline/* person@sentry.io #infra
module:com.module.name.example #sdks
url:http://example.com/settings/* #product
tags.sku_class:enterprise #enterprise`;
  }

  getDetail() {
    return tct(
      `Auto-assign issues to users and teams. To learn more, [link:read the docs].`,
      {
        link: (
          <ExternalLink href="https://docs.sentry.io/product/error-monitoring/issue-owners/" />
        ),
      }
    );
  }

  handleOwnershipSave = (text: string | null) => {
    this.setState(prevState => ({
      ...(prevState.ownership
        ? {
            ownership: {
              ...prevState.ownership,
              raw: text || '',
            },
          }
        : {}),
    }));
  };

  handleCodeOwnerAdded = (data: CodeOwner) => {
    const {codeowners} = this.state;
    const newCodeowners = [data, ...(codeowners || [])];
    this.setState({codeowners: newCodeowners});
  };

  handleCodeOwnerDeleted = (data: CodeOwner) => {
    const {codeowners} = this.state;
    const newCodeowners = (codeowners || []).filter(
      codeowner => codeowner.id !== data.id
    );
    this.setState({codeowners: newCodeowners});
  };

  handleCodeOwnerUpdated = (data: CodeOwner) => {
    const codeowners = this.state.codeowners || [];
    const index = codeowners.findIndex(item => item.id === data.id);
    this.setState({
      codeowners: [...codeowners.slice(0, index), data, ...codeowners.slice(index + 1)],
    });
  };

  renderBody() {
    const {project, organization} = this.props;
    const {ownership, codeowners} = this.state;

    const disabled = !organization.access.includes('project:write');
    const editOwnershipeRulesDisabled = !organization.access.includes('project:read');
    const hasStreamlineTargetingContext = organization.features?.includes(
      'streamline-targeting-context'
    );
    const hasCodeowners = organization.features?.includes('integrations-codeowners');

    return (
      <Fragment>
        <SettingsPageHeader
          title={this.getOwnershipTitle()}
          action={
            <Fragment>
              {hasStreamlineTargetingContext ? (
                <Button
                  type="button"
                  size="sm"
                  icon={<IconEdit size="xs" />}
                  onClick={() =>
                    openEditOwnershipRules({
                      organization,
                      project,
                      ownership: ownership!,
                      onSave: this.handleOwnershipSave,
                    })
                  }
                  disabled={!!ownership && editOwnershipeRulesDisabled}
                >
                  {t('Edit Rules')}
                </Button>
              ) : (
                <Button
                  to={{
                    pathname: `/organizations/${organization.slug}/issues/`,
                    query: {project: project.id},
                  }}
                  size="sm"
                >
                  {t('View Issues')}
                </Button>
              )}
              {hasCodeowners && (
                <Access access={['org:integrations']}>
                  {({hasAccess}) =>
                    hasAccess ? (
                      <CodeOwnerButton
                        onClick={this.handleAddCodeOwner}
                        size="sm"
                        priority="primary"
                        data-test-id="add-codeowner-button"
                      >
                        {t('Add CODEOWNERS')}
                      </CodeOwnerButton>
                    ) : null
                  }
                </Access>
              )}
            </Fragment>
          }
        />
        <IssueOwnerDetails>{this.getDetail()}</IssueOwnerDetails>

        <PermissionAlert
          access={!editOwnershipeRulesDisabled ? ['project:read'] : ['project:write']}
        />
        <CodeOwnerErrors
          orgSlug={organization.slug}
          projectSlug={project.slug}
          codeowners={codeowners ?? []}
        />
        {hasStreamlineTargetingContext && ownership && (
          <ErrorBoundary mini>
            <OwnershipRulesTable
              projectRules={ownership.schema?.rules ?? []}
              codeowners={codeowners ?? []}
            />
          </ErrorBoundary>
        )}
        {!hasStreamlineTargetingContext && ownership && (
          <RulesPanel
            data-test-id="issueowners-panel"
            type="issueowners"
            raw={ownership.raw || ''}
            dateUpdated={ownership.lastUpdated}
            placeholder={this.getPlaceholder()}
            controls={[
              <Button
                key="edit"
                size="xs"
                onClick={() =>
                  openEditOwnershipRules({
                    organization,
                    project,
                    ownership,
                    onSave: this.handleOwnershipSave,
                  })
                }
                disabled={editOwnershipeRulesDisabled}
              >
                {t('Edit')}
              </Button>,
            ]}
          />
        )}
        <PermissionAlert />
        {hasCodeowners &&
          (hasStreamlineTargetingContext ? (
            <CodeOwnerFileTable
              project={project}
              codeowners={codeowners ?? []}
              onDelete={this.handleCodeOwnerDeleted}
              onUpdate={this.handleCodeOwnerUpdated}
              disabled={disabled}
            />
          ) : (
            <CodeOwnersPanel
              codeowners={codeowners || []}
              onDelete={this.handleCodeOwnerDeleted}
              onUpdate={this.handleCodeOwnerUpdated}
              disabled={disabled}
              {...this.props}
            />
          ))}
        {ownership && (
          <Form
            apiEndpoint={`/projects/${organization.slug}/${project.slug}/ownership/`}
            apiMethod="PUT"
            saveOnBlur
            initialData={{
              fallthrough: ownership.fallthrough,
              autoAssignment: ownership.autoAssignment,
              codeownersAutoSync: ownership.codeownersAutoSync,
            }}
            hideFooter
          >
            <JsonForm
              forms={[
                {
                  title: t('Issue Owners'),
                  fields: [
                    {
                      name: 'autoAssignment',
                      type: 'choice',
                      label: t('Prioritize Auto Assignment'),
                      help: t(
                        "When there's a conflict between suspect commit and ownership rules."
                      ),
                      choices: [
                        [
                          'Auto Assign to Suspect Commits',
                          t('Auto-assign to suspect commits'),
                        ],
                        ['Auto Assign to Issue Owner', t('Auto-assign to issue owner')],
                        ['Turn off Auto-Assignment', t('Turn off auto-assignment')],
                      ],
                      disabled,
                    },
                    ...(organization.features.includes('issue-alert-fallback-targeting')
                      ? []
                      : [
                          {
                            name: 'fallthrough',
                            type: 'boolean' as const,
                            label: t(
                              'Send alert to project members if there’s no assigned owner'
                            ),
                            help: t(
                              'Alerts will be sent to all users who have access to this project.'
                            ),
                            disabled,
                          },
                        ]),
                    {
                      name: 'codeownersAutoSync',
                      type: 'boolean',
                      label: t('Sync changes from CODEOWNERS'),
                      help: t(
                        'We’ll update any changes you make to your CODEOWNERS files during a release.'
                      ),
                      disabled: disabled || !(this.state.codeowners || []).length,
                    },
                  ],
                },
              ]}
            />
          </Form>
        )}
      </Fragment>
    );
  }
}

export default ProjectOwnership;

const CodeOwnerButton = styled(Button)`
  margin-left: ${space(1)};
`;

const IssueOwnerDetails = styled('div')`
  padding-bottom: ${space(3)};
`;
