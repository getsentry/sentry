import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody} from 'app/components/panels';
import {IconCheckmark, IconNot} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {
  CodeOwners,
  Integration,
  Organization,
  Project,
  RepositoryProjectPathConfig,
} from 'app/types';
import {getIntegrationIcon} from 'app/utils/integrationUtil';
import withApi from 'app/utils/withApi';
import Form from 'app/views/settings/components/forms/form';
import SelectField from 'app/views/settings/components/forms/selectField';

type Props = {
  api: Client;
  organization: Organization;
  project: Project;
  codeMappings: RepositoryProjectPathConfig[];
  integrations: Integration[];
  onSave: (data: CodeOwners) => void;
} & ModalRenderProps;

type State = {
  codeownerFile: CodeOwnerFile | null;
  codeMappingId: string | null;
  isLoading: boolean;
  error: boolean;
  errorJSON: {raw?: string} | null;
};

type CodeOwnerFile = {
  raw: string;
  filepath: string;
  html_url: string;
};

class AddCodeOwnerModal extends Component<Props, State> {
  state: State = {
    codeownerFile: null,
    codeMappingId: null,
    isLoading: false,
    error: false,
    errorJSON: null,
  };

  fetchFile = async (codeMappingId: string) => {
    const {organization} = this.props;
    this.setState({
      codeMappingId,
      codeownerFile: null,
      error: false,
      errorJSON: null,
      isLoading: true,
    });
    try {
      const data: CodeOwnerFile = await this.props.api.requestPromise(
        `/organizations/${organization.slug}/code-mappings/${codeMappingId}/codeowners/`,
        {
          method: 'GET',
        }
      );
      this.setState({codeownerFile: data, isLoading: false});
    } catch (_err) {
      this.setState({isLoading: false});
    }
  };

  addFile = async () => {
    const {organization, project, codeMappings} = this.props;
    const {codeownerFile, codeMappingId} = this.state;

    if (codeownerFile) {
      const postData: {
        codeMappingId: string | null;
        raw: string;
      } = {
        codeMappingId,
        raw: codeownerFile.raw,
      };

      try {
        const data = await this.props.api.requestPromise(
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
          addErrorMessage(t(Object.values(err.responseJSON).flat().join(' ')));
        }
      }
    }
  };

  handleAddedFile(data: CodeOwners) {
    this.props.onSave(data);
    this.props.closeModal();
  }

  sourceFile(codeownerFile: CodeOwnerFile) {
    return (
      <Panel>
        <SourceFileBody>
          <IconCheckmark size="md" isCircled color="green200" />
          {codeownerFile.filepath}
          <Button size="small" href={codeownerFile.html_url} target="_blank">
            {t('Preview File')}
          </Button>
        </SourceFileBody>
      </Panel>
    );
  }

  errorMessage(baseUrl) {
    const {errorJSON, codeMappingId} = this.state;
    const {codeMappings} = this.props;
    const codeMapping = codeMappings.find(mapping => mapping.id === codeMappingId);
    const {integrationId, provider} = codeMapping as RepositoryProjectPathConfig;
    const errActors = errorJSON?.raw?.[0].split('\n').map(el => <p>{el}</p>);
    return (
      <Alert type="error" icon={<IconNot size="md" />}>
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

  render() {
    const {Header, Body, Footer} = this.props;
    const {codeownerFile, error, errorJSON} = this.state;
    const {codeMappings, integrations, organization} = this.props;
    const baseUrl = `/settings/${organization.slug}/integrations`;

    return (
      <Fragment>
        <Header closeButton>{t('Add Code Owner File')}</Header>
        <Body>
          {!codeMappings.length && (
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
                    type="button"
                    to={`${baseUrl}/${integration.provider.key}/${integration.id}/?tab=codeMappings&referrer=add-codeowners`}
                  >
                    {getIntegrationIcon(integration.provider.key)}
                    <IntegrationName>{integration.name}</IntegrationName>
                  </Button>
                ))}
              </IntegrationsList>
            </Fragment>
          )}
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
                choices={codeMappings.map((cm: RepositoryProjectPathConfig) => [
                  cm.id,
                  cm.repoName,
                ])}
                onChange={this.fetchFile}
                required
                inline={false}
                flexibleControlStateSize
                stacked
              />

              <FileResult>
                {codeownerFile ? this.sourceFile(codeownerFile) : this.noSourceFile()}
                {error && errorJSON && this.errorMessage(baseUrl)}
              </FileResult>
            </Form>
          )}
        </Body>
        <Footer>
          <Button
            disabled={codeownerFile ? false : true}
            label={t('Add File')}
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

export default withApi(AddCodeOwnerModal);
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
  grid-gap: ${space(1)};
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
