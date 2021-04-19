import React from 'react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody} from 'app/components/panels';
import {IconCheckmark, IconNot} from 'app/icons';
import {t} from 'app/locale';
import {CodeOwners, Organization, Project} from 'app/types';
import withApi from 'app/utils/withApi';
import Form from 'app/views/settings/components/forms/form';
import SelectField from 'app/views/settings/components/forms/selectField';

type Props = {
  api: Client;
  organization: Organization;
  project: Project;
  codeMappings: any;
  onSave: (data: any) => void;
} & ModalRenderProps;

type State = {
  codeownerFile: CodeOwnerFile | null;
  codeMappingId: number | null;
  isLoading: boolean;
  error: boolean;
  errorJSON: Object | null;
};

type CodeOwnerFile = {
  raw: string;
  filepath: string;
  html_url: string;
};

class AddCodeOwnerModal extends React.Component<Props, State> {
  state = {
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
      const data = await this.props.api.requestPromise(
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
      const codeMapping = codeMappings.find(mapping => mapping.id === codeMappingId);
      this.handleAddedFile({...data, codeMapping});
    } catch (_err) {
      this.setState({error: true, errorJSON: _err.responseJSON, isLoading: false});
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
          <Button size="small" href={codeownerFile.html_url}>
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
        <p>{errorJSON.raw[0]}</p>
      </Alert>
    );
  }

  noSourceFile() {
    const {codeMappingId, isLoading} = this.state;
    if (isLoading) {
      return (
        <Panel>
          <NoSourceFileBody>
            <LoadingIndicator mini />
          </NoSourceFileBody>
        </Panel>
      );
    }
    if (!codeMappingId) {
      return null;
    }
    return (
      <Panel>
        <NoSourceFileBody>
          {codeMappingId ? (
            <React.Fragment>
              <IconNot size="md" color="red200" />
              {t('No codeowner file found.')}
            </React.Fragment>
          ) : null}
        </NoSourceFileBody>
      </Panel>
    );
  }

  render() {
    const {Header, Body, Footer, closeModal} = this.props;
    const {codeownerFile, error, errorJSON} = this.state;
    const {codeMappings} = this.props;
    return (
      <React.Fragment>
        <Header closeButton onHide={closeModal}>
          <h4>{t('Add Code Owner File')}</h4>
        </Header>
        <Body>
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
                choices={codeMappings.map(cm => [cm.id, cm.repoName])}
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
      </React.Fragment>
    );
  }
}

export default withApi(AddCodeOwnerModal);

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
  align-items: flex-start;
  min-height: 150px;
`;
const SourceFileBody = styled(PanelBody)`
  display: grid;
  padding: 12px;
  grid-template-columns: 30px 1fr 100px;
  align-items: flex-start;
  min-height: 150px;
`;
