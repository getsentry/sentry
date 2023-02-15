import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Alert} from 'sentry/components/alert';
import AsyncComponent from 'sentry/components/asyncComponent';
import {Button} from 'sentry/components/button';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form from 'sentry/components/forms/form';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelBody} from 'sentry/components/panels';
import {IconCheckmark, IconNot} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  CodeOwner,
  CodeownersFile,
  Integration,
  Organization,
  Project,
  RepositoryProjectPathConfig,
} from 'sentry/types';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';

type Props = {
  organization: Organization;
  project: Project;
  onSave?: (data: CodeOwner) => void;
} & ModalRenderProps &
  AsyncComponent['props'];

type State = {
  codeMappingId: string | null;
  codeMappings: RepositoryProjectPathConfig[];
  codeownersFile: CodeownersFile | null;
  error: boolean;
  errorJSON: {raw?: string} | null;
  integrations: Integration[];
  isLoading: boolean;
} & AsyncComponent['state'];

class AddCodeOwnerModal extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      codeownersFile: null,
      codeMappingId: null,
      isLoading: false,
      error: false,
      errorJSON: null,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, project} = this.props;
    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [
      [
        'codeMappings',
        `/organizations/${organization.slug}/code-mappings/`,
        {query: {project: project.id}},
      ],
      [
        'integrations',
        `/organizations/${organization.slug}/integrations/`,
        {query: {features: ['codeowners']}},
      ],
    ];
    return endpoints;
  }

  fetchFile = async (codeMappingId: string) => {
    const {organization} = this.props;
    this.setState({
      codeMappingId,
      codeownersFile: null,
      error: false,
      errorJSON: null,
      isLoading: true,
    });
    try {
      const data: CodeownersFile = await this.api.requestPromise(
        `/organizations/${organization.slug}/code-mappings/${codeMappingId}/codeowners/`,
        {
          method: 'GET',
        }
      );
      this.setState({codeownersFile: data, isLoading: false});
    } catch (_err) {
      this.setState({isLoading: false});
    }
  };

  addFile = async () => {
    const {organization, project} = this.props;
    const {codeownersFile, codeMappingId, codeMappings} = this.state;

    if (codeownersFile) {
      const postData: {
        codeMappingId: string | null;
        raw: string;
      } = {
        codeMappingId,
        raw: codeownersFile.raw,
      };

      try {
        const data = await this.api.requestPromise(
          `/projects/${organization.slug}/${project.slug}/codeowners/`,
          {
            method: 'POST',
            data: postData,
          }
        );

        const codeMapping = codeMappings.find(
          mapping => mapping.id === codeMappingId?.toString()
        );

        this.handleAddedFile({...data, codeMapping});
      } catch (err) {
        if (err.responseJSON.raw) {
          this.setState({error: true, errorJSON: err.responseJSON, isLoading: false});
        } else {
          addErrorMessage(Object.values(err.responseJSON).flat().join(' '));
        }
      }
    }
  };

  handleAddedFile(data: CodeOwner) {
    this.props.onSave && this.props.onSave(data);
    this.props.closeModal();
  }

  sourceFile(codeownersFile: CodeownersFile) {
    return (
      <Panel>
        <SourceFileBody>
          <IconCheckmark size="md" isCircled color="green200" />
          {codeownersFile.filepath}
          <Button size="sm" href={codeownersFile.html_url} external>
            {t('Preview File')}
          </Button>
        </SourceFileBody>
      </Panel>
    );
  }

  errorMessage(baseUrl) {
    const {errorJSON, codeMappingId, codeMappings} = this.state;
    const codeMapping = codeMappings.find(mapping => mapping.id === codeMappingId);
    const {integrationId, provider} = codeMapping as RepositoryProjectPathConfig;
    const errActors = errorJSON?.raw?.[0].split('\n').map((el, i) => <p key={i}>{el}</p>);
    return (
      <Alert type="error" showIcon>
        {errActors}
        {codeMapping && (
          <p>
            {tct(
              'Configure [userMappingsLink:User Mappings] or [teamMappingsLink:Team Mappings] for any missing associations.',
              {
                userMappingsLink: (
                  <Link
                    to={`${baseUrl}/${provider?.key}/${integrationId}/?tab=userMappings&referrer=add-codeowners`}
                  />
                ),
                teamMappingsLink: (
                  <Link
                    to={`${baseUrl}/${provider?.key}/${integrationId}/?tab=teamMappings&referrer=add-codeowners`}
                  />
                ),
              }
            )}
          </p>
        )}
        {tct(
          '[addAndSkip:Add and Skip Missing Associations] will add your codeowner file and skip any rules that having missing associations. You can add associations later for any skipped rules.',
          {addAndSkip: <strong>Add and Skip Missing Associations</strong>}
        )}
      </Alert>
    );
  }

  noSourceFile() {
    const {codeMappingId, isLoading} = this.state;
    if (isLoading) {
      return (
        <Container>
          <LoadingIndicator mini />
        </Container>
      );
    }
    if (!codeMappingId) {
      return null;
    }
    return (
      <Panel>
        <NoSourceFileBody>
          {codeMappingId ? (
            <Fragment>
              <IconNot size="md" color="red200" />
              {t('No codeowner file found.')}
            </Fragment>
          ) : null}
        </NoSourceFileBody>
      </Panel>
    );
  }

  renderBody() {
    const {Header, Body, Footer} = this.props;
    const {codeownersFile, error, errorJSON, codeMappings, integrations} = this.state;
    const {organization} = this.props;
    const baseUrl = `/settings/${organization.slug}/integrations`;

    return (
      <Fragment>
        <Header closeButton>{t('Add Code Owner File')}</Header>
        <Body>
          {!codeMappings.length ? (
            !integrations.length ? (
              <Fragment>
                <div>
                  {t('Install a GitHub or GitLab integration to use this feature.')}
                </div>
                <Container style={{paddingTop: space(2)}}>
                  <Button priority="primary" size="sm" to={baseUrl}>
                    Setup Integration
                  </Button>
                </Container>
              </Fragment>
            ) : (
              <Fragment>
                <div>
                  {t(
                    "Configure code mapping to add your CODEOWNERS file. Select the integration you'd like to use for mapping:"
                  )}
                </div>
                <IntegrationsList>
                  {integrations.map(integration => (
                    <Button
                      key={integration.id}
                      to={`${baseUrl}/${integration.provider.key}/${integration.id}/?tab=codeMappings&referrer=add-codeowners`}
                    >
                      {getIntegrationIcon(integration.provider.key)}
                      <IntegrationName>{integration.name}</IntegrationName>
                    </Button>
                  ))}
                </IntegrationsList>
              </Fragment>
            )
          ) : null}
          {codeMappings.length > 0 && (
            <Form
              apiMethod="POST"
              apiEndpoint="/code-mappings/"
              hideFooter
              initialData={{}}
            >
              <StyledSelectField
                name="codeMappingId"
                label={t('Apply an existing code mapping')}
                options={codeMappings.map((cm: RepositoryProjectPathConfig) => ({
                  value: cm.id,
                  label: cm.repoName,
                }))}
                onChange={this.fetchFile}
                required
                inline={false}
                flexibleControlStateSize
                stacked
              />

              <FileResult>
                {codeownersFile ? this.sourceFile(codeownersFile) : this.noSourceFile()}
                {error && errorJSON && this.errorMessage(baseUrl)}
              </FileResult>
            </Form>
          )}
        </Body>
        <Footer>
          <Button
            disabled={codeownersFile ? false : true}
            aria-label={t('Add File')}
            priority="primary"
            onClick={this.addFile}
          >
            {t('Add File')}
          </Button>
        </Footer>
      </Fragment>
    );
  }
}

export default AddCodeOwnerModal;
export {AddCodeOwnerModal};

const StyledSelectField = styled(SelectField)`
  border-bottom: None;
  padding-right: 16px;
`;
const FileResult = styled('div')`
  width: inherit;
`;
const NoSourceFileBody = styled(PanelBody)`
  display: grid;
  padding: 12px;
  grid-template-columns: 30px 1fr;
  align-items: center;
`;
const SourceFileBody = styled(PanelBody)`
  display: grid;
  padding: 12px;
  grid-template-columns: 30px 1fr 100px;
  align-items: center;
`;

const IntegrationsList = styled('div')`
  display: grid;
  gap: ${space(1)};
  justify-items: center;
  margin-top: ${space(2)};
`;

const IntegrationName = styled('p')`
  padding-left: 10px;
`;

const Container = styled('div')`
  display: flex;
  justify-content: center;
`;
