import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody} from 'app/components/panels';
import {IconCheckmark, IconNot} from 'app/icons';
import {t} from 'app/locale';
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
  codeMappingId: number | null;
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

  fetchFile = async (codeMappingId: number) => {
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
      try {
        const data = await this.props.api.requestPromise(
          `/projects/${organization.slug}/${project.slug}/codeowners/`,
          {
            method: 'POST',
            data: {
              codeMappingId,
              raw: codeownerFile.raw,
            },
          }
        );
        const codeMapping = codeMappings.find(
          mapping => mapping.id === codeMappingId?.toString()
        );
        this.handleAddedFile({...data, codeMapping});
      } catch (_err) {
        this.setState({error: true, errorJSON: _err.responseJSON, isLoading: false});
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

  errorMessage() {
    const {errorJSON} = this.state;
    return (
      <Alert type="error" icon={<IconNot size="md" />}>
        <p>{errorJSON?.raw?.[0]}</p>
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
            <React.Fragment>
              <div>
                {t(
                  "Configure stack trace linking to add your CODEOWNERS file. Select the integration you'd like to use for mapping:"
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
            </React.Fragment>
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
                {error && errorJSON && this.errorMessage()}
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
