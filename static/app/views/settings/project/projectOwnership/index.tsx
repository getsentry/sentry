import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {openEditOwnershipRules, openModal} from 'app/actionCreators/modal';
import Access from 'app/components/acl/access';
import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import HookOrDefault from 'app/components/hookOrDefault';
import ExternalLink from 'app/components/links/externalLink';
import {IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {
  CodeOwner,
  Integration,
  Organization,
  Project,
  RepositoryProjectPathConfig,
} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';
import FeedbackAlert from 'app/views/settings/account/notifications/feedbackAlert';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import AddCodeOwnerModal from 'app/views/settings/project/projectOwnership/addCodeOwnerModal';
import CodeOwnersPanel from 'app/views/settings/project/projectOwnership/codeowners';
import RulesPanel from 'app/views/settings/project/projectOwnership/rulesPanel';

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<{orgId: string; projectId: string}, {}>;

type State = {
  ownership: null | any;
  codeMappings: RepositoryProjectPathConfig[];
  codeowners?: CodeOwner[];
  integrations: Integration[];
} & AsyncView['state'];

const CodeOwnersHeader = HookOrDefault({
  hookName: 'component:codeowners-header',
  defaultComponent: () => <Fragment />,
});

class ProjectOwnership extends AsyncView<Props, State> {
  getTitle() {
    const {project} = this.props;
    return routeTitleGen(t('Issue Owners'), project.slug, false);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, project} = this.props;
    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      ['ownership', `/projects/${organization.slug}/${project.slug}/ownership/`],
      [
        'codeMappings',
        `/organizations/${organization.slug}/code-mappings/`,
        {query: {projectId: project.id}},
      ],
      [
        'integrations',
        `/organizations/${organization.slug}/integrations/`,
        {query: {features: ['codeowners']}},
      ],
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
    const {codeMappings, integrations} = this.state;
    openModal(modalProps => (
      <AddCodeOwnerModal
        {...modalProps}
        organization={this.props.organization}
        project={this.props.project}
        codeMappings={codeMappings}
        integrations={integrations}
        onSave={this.handleCodeOwnerAdded}
      />
    ));
  };

  getPlaceholder() {
    return `#example usage
path:src/example/pipeline/* person@sentry.io #infra
url:http://example.com/settings/* #product
tags.sku_class:enterprise #enterprise`;
  }

  getDetail() {
    return tct(
      `Automatically assign issues and send alerts to the right people based on issue properties. [link:Learn more].`,
      {
        link: (
          <ExternalLink href="https://docs.sentry.io/product/error-monitoring/issue-owners/" />
        ),
      }
    );
  }

  handleOwnershipSave = (text: string | null) => {
    this.setState(prevState => ({
      ownership: {
        ...prevState.ownership,
        raw: text,
      },
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

  renderCodeOwnerErrors = () => {
    const {project, organization} = this.props;
    const {codeowners} = this.state;

    const errMessageComponent = (message, values, link, linkValue) => (
      <Fragment>
        <ErrorMessageContainer>
          <span>{message}</span>
          <b>{values.join(', ')}</b>
        </ErrorMessageContainer>
        <ErrorCtaContainer>
          <ExternalLink href={link}>{linkValue}</ExternalLink>
        </ErrorCtaContainer>
      </Fragment>
    );

    const errMessageListComponent = (
      message: string,
      values: string[],
      linkFunction: (s: string) => string,
      linkValueFunction: (s: string) => string
    ) => {
      return (
        <Fragment>
          <ErrorMessageContainer>
            <span>{message}</span>
          </ErrorMessageContainer>
          <ErrorMessageListContainer>
            {values.map((value, index) => (
              <ErrorInlineContainer key={index}>
                <b>{value}</b>
                <ErrorCtaContainer>
                  <ExternalLink href={linkFunction(value)} key={index}>
                    {linkValueFunction(value)}
                  </ExternalLink>
                </ErrorCtaContainer>
              </ErrorInlineContainer>
            ))}
          </ErrorMessageListContainer>
        </Fragment>
      );
    };

    return (codeowners || [])
      .filter(({errors}) => Object.values(errors).flat().length)
      .map(({id, codeMapping, errors}) => {
        const errMessage = (type, values) => {
          switch (type) {
            case 'missing_external_teams':
              return errMessageComponent(
                `The following teams do not have an association in the organization: ${organization.slug}`,
                values,
                `/settings/${organization.slug}/integrations/${codeMapping?.provider?.slug}/${codeMapping?.integrationId}/?tab=teamMappings`,
                'Configure Team Mappings'
              );

            case 'missing_external_users':
              return errMessageComponent(
                `The following usernames do not have an association in the organization: ${organization.slug}`,
                values,
                `/settings/${organization.slug}/integrations/${codeMapping?.provider?.slug}/${codeMapping?.integrationId}/?tab=userMappings`,
                'Configure User Mappings'
              );

            case 'missing_user_emails':
              return errMessageComponent(
                `The following emails do not have an Sentry user in the organization: ${organization.slug}`,
                values,
                `/settings/${organization.slug}/members/`,
                'Invite Users'
              );

            case 'teams_without_access':
              return errMessageListComponent(
                `The following team do not have access to the project: ${project.slug}`,
                values,
                value =>
                  `/settings/${organization.slug}/teams/${value.slice(1)}/projects/`,
                value => `Configure ${value} Permissions`
              );

            case 'users_without_access':
              return errMessageListComponent(
                `The following users are not on a team that has access to the project: ${project.slug}`,
                values,
                email => `/settings/${organization.slug}/members/?query=${email}`,
                _ => `Configure Member Settings`
              );
            default:
              return null;
          }
        };
        return (
          <Alert
            key={id}
            type="error"
            icon={<IconWarning size="md" />}
            expand={[
              <AlertContentContainer key="container">
                {Object.entries(errors)
                  .filter(([_, values]) => values.length)
                  .map(([type, values]) => (
                    <ErrorContainer key={`${id}-${type}`}>
                      {errMessage(type, values)}
                    </ErrorContainer>
                  ))}
              </AlertContentContainer>,
            ]}
          >
            {`There were ${
              Object.values(errors).flat().length
            } ownership issues within Sentry on the latest sync with the CODEOWNERS file`}
          </Alert>
        );
      });
  };
  renderBody() {
    const {project, organization} = this.props;
    const {ownership, codeowners} = this.state;

    const disabled = !organization.access.includes('project:write');

    return (
      <Fragment>
        <SettingsPageHeader
          title={t('Issue Owners')}
          action={
            <Fragment>
              <Button
                to={{
                  pathname: `/organizations/${organization.slug}/issues/`,
                  query: {project: project.id},
                }}
                size="small"
              >
                {t('View Issues')}
              </Button>
              <Feature features={['integrations-codeowners']}>
                <Access access={['project:write']}>
                  {({hasAccess}) =>
                    hasAccess && (
                      <CodeOwnerButton
                        onClick={this.handleAddCodeOwner}
                        size="small"
                        priority="primary"
                        data-test-id="add-codeowner-button"
                      >
                        {t('Add CODEOWNERS File')}
                      </CodeOwnerButton>
                    )
                  }
                </Access>
              </Feature>
            </Fragment>
          }
        />
        <IssueOwnerDetails>{this.getDetail()}</IssueOwnerDetails>
        <CodeOwnersHeader addCodeOwner={this.handleAddCodeOwner} />

        <PermissionAlert />
        <FeedbackAlert />
        {this.renderCodeOwnerErrors()}
        <RulesPanel
          data-test-id="issueowners-panel"
          type="issueowners"
          raw={ownership.raw || ''}
          dateUpdated={ownership.lastUpdated}
          placeholder={this.getPlaceholder()}
          controls={[
            <Button
              key="edit"
              size="xsmall"
              onClick={() =>
                openEditOwnershipRules({
                  organization,
                  project,
                  ownership,
                  onSave: this.handleOwnershipSave,
                })
              }
              disabled={disabled}
            >
              {t('Edit')}
            </Button>,
          ]}
        />
        <Feature features={['integrations-codeowners']}>
          <CodeOwnersPanel
            codeowners={codeowners || []}
            onDelete={this.handleCodeOwnerDeleted}
            onUpdate={this.handleCodeOwnerUpdated}
            disabled={disabled}
            {...this.props}
          />
        </Feature>
        <Form
          apiEndpoint={`/projects/${organization.slug}/${project.slug}/ownership/`}
          apiMethod="PUT"
          saveOnBlur
          initialData={{
            fallthrough: ownership.fallthrough,
            autoAssignment: ownership.autoAssignment,
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
                    type: 'boolean',
                    label: t('Automatically assign issues'),
                    help: t('Assign issues when a new event matches the rules above.'),
                    disabled,
                  },
                  {
                    name: 'fallthrough',
                    type: 'boolean',
                    label: t(
                      'Send alert to project members if there’s no assigned owner'
                    ),
                    help: t(
                      'Alerts will be sent to all users who have access to this project.'
                    ),
                    disabled,
                  },
                ],
              },
            ]}
          />
        </Form>
      </Fragment>
    );
  }
}

export default ProjectOwnership;

const CodeOwnerButton = styled(Button)`
  margin-left: ${space(1)};
`;

const AlertContentContainer = styled('div')`
  overflow-y: auto;
  max-height: 350px;
`;

const ErrorContainer = styled('div')`
  display: grid;
  grid-template-areas: 'message cta';
  grid-template-columns: 2fr 1fr;
  gap: ${space(2)};
  padding: ${space(1.5)} 0;
`;

const ErrorInlineContainer = styled(ErrorContainer)`
  gap: ${space(1.5)};
  grid-template-columns: 1fr 2fr;
  align-items: center;
  padding: 0;
`;

const ErrorMessageContainer = styled('div')`
  grid-area: message;
  display: grid;
  gap: ${space(1.5)};
`;

const ErrorMessageListContainer = styled('div')`
  grid-column: message / cta-end;
  gap: ${space(1.5)};
`;

const ErrorCtaContainer = styled('div')`
  grid-area: cta;
  justify-self: flex-end;
  text-align: right;
  line-height: 1.5;
`;

const IssueOwnerDetails = styled('div')`
  padding-bottom: ${space(3)};
`;
