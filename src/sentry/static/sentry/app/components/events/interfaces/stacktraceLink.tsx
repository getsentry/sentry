import React from 'react';
import Modal from 'react-bootstrap/lib/Modal';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {
  Event,
  Frame,
  Integration,
  Organization,
  Project,
  RepositoryProjectPathConfig,
} from 'app/types';
import {getIntegrationIcon, trackIntegrationEvent} from 'app/utils/integrationUtil';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';
import InputField from 'app/views/settings/components/forms/inputField';

import {OpenInContainer, OpenInLink, OpenInName} from './openInContextLine';

type Props = AsyncComponent['props'] & {
  frame: Frame;
  event: Event;
  organization: Organization;
  lineNo: number;
  projects: Project[];
};

//format of the ProjectStacktraceLinkEndpoint response
type StacktraceResultItem = {
  integrations: Integration[];
  config?: RepositoryProjectPathConfig;
  sourceUrl?: string;
  error?: 'file_not_found' | 'stack_root_mismatch';
};

type State = AsyncComponent['state'] & {
  match: StacktraceResultItem;
  showModal: boolean;
  sourceCodeInput: string;
};

class StacktraceLink extends AsyncComponent<Props, State> {
  get project() {
    // we can't use the withProject HoC on an the issue page
    // so we ge around that by using the withProjects HoC
    // and look up the project from the list
    const {projects, event} = this.props;
    return projects.find(project => project.id === event.projectID);
  }
  get match() {
    return this.state.match;
  }
  get config() {
    return this.match.config;
  }

  get integrations() {
    return this.match.integrations;
  }

  get errorText() {
    const error = this.match.error;

    switch (error) {
      case 'stack_root_mismatch':
        return t('Error matching your configuration, check your stack trace root.');
      case 'file_not_found':
        return t(
          'Could not find source file, check your repository and source code root.'
        );
      default:
        return t('There was an error encountered with the code mapping for this project');
    }
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, frame, event} = this.props;
    const project = this.project;
    if (!project) {
      throw new Error('Unable to find project');
    }
    const commitId = event.release?.lastCommit?.id;
    return [
      [
        'match',
        `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
        {query: {file: frame.filename, commitId}},
      ],
    ];
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      showModal: false,
      sourceCodeInput: '',
      match: {integrations: []},
    };
  }

  openModal() {
    this.setState({
      showModal: true,
    });
  }

  closeModal() {
    this.setState({
      showModal: false,
    });
  }

  onHandleChange(value: string) {
    this.setState({
      sourceCodeInput: value,
    });
  }

  onOpenLink() {
    const provider = this.config?.provider;
    if (provider) {
      trackIntegrationEvent(
        {
          eventKey: 'integrations.stacktrace_link_clicked',
          eventName: 'Integrations: Stacktrace Link Clicked',
          view: 'stacktrace_issue_details',
          provider: provider.key,
        },
        this.props.organization,
        {startSession: true}
      );
    }
  }
  onReconfigureMapping() {
    const provider = this.config?.provider;
    const error = this.match.error;
    if (provider) {
      trackIntegrationEvent(
        {
          eventKey: 'integrations.reconfigure_stacktrace_setup',
          eventName: 'Integrations: Reconfigure Stacktrace Setup',
          view: 'stacktrace_issue_details',
          provider: provider.key,
          error_reason: error,
        },
        this.props.organization,
        {startSession: true}
      );
    }
  }

  // let the ErrorBoundary handle errors by raising it
  renderError(): React.ReactNode {
    throw new Error('Error loading endpoints');
  }

  renderLoading() {
    //TODO: Add loading
    return null;
  }
  renderNoMatch() {
    const {showModal, sourceCodeInput} = this.state;
    const {organization} = this.props;
    const filename = this.props.frame.filename;
    const baseUrl = `/settings/${organization.slug}/integrations`;

    if (this.integrations) {
      return (
        <CodeMappingButtonContainer columnQuantity={2}>
          {t('Enable source code stack trace linking by setting up a code mapping.')}
          <Button onClick={() => this.openModal()} size="xsmall">
            {t('Setup Code Mapping')}
          </Button>
          <Modal
            show={showModal}
            onHide={() => this.closeModal()}
            enforceFocus={false}
            backdrop="static"
            animation={false}
          >
            <Modal.Header closeButton>{t('Code Mapping Setup')}</Modal.Header>
            <Modal.Body>
              <ModalContainer>
                <div>
                  <h6>{t('Quick Setup')}</h6>
                  {tct(
                    'Enter in your source code url that corresponsds to stack trace filename [filename]. We will create a code mapping with this information.',
                    {
                      filename: <code>{filename}</code>,
                    }
                  )}
                </div>
                <SourceCodeInput>
                  <StyledInputField
                    inline={false}
                    flexibleControlStateSize
                    stacked
                    name="source-code-input"
                    type="text"
                    value={sourceCodeInput}
                    onChange={val => this.onHandleChange(val)}
                    placeholder={t(
                      `https://github.com/octocat/Hello-World/blob/master/${filename}`
                    )}
                  />
                  <ButtonBar>
                    <Button type="button" onClick={() => {}}>
                      {t('Submit')}
                    </Button>
                  </ButtonBar>
                </SourceCodeInput>
                <div>
                  <h6>{t('Manual Setup')}</h6>
                  {t(
                    'To set up a code mapping manually, select which of your following integrations you want to set up the mapping for:'
                  )}
                </div>
                <ManualSetup>
                  {this.integrations.map(integration => (
                    <Button
                      key={integration.id}
                      type="button"
                      to={`${baseUrl}/${integration.provider.key}/${integration.id}/?tab=codeMappings`}
                    >
                      {getIntegrationIcon(integration.provider.key)}
                      <IntegrationName>{integration.name}</IntegrationName>
                    </Button>
                  ))}
                </ManualSetup>
              </ModalContainer>
            </Modal.Body>
            <Modal.Footer></Modal.Footer>
          </Modal>
        </CodeMappingButtonContainer>
      );
    }
    return null;
  }
  renderMatchNoUrl() {
    const {config} = this.match;
    const {organization} = this.props;
    const text = this.errorText;
    const url = `/settings/${organization.slug}/integrations/${config?.provider.key}/${config?.integrationId}/?tab=codeMappings`;
    return (
      <CodeMappingButtonContainer columnQuantity={2}>
        {text}
        <Button onClick={() => this.onReconfigureMapping()} to={url} size="xsmall">
          {t('Configure Code Mapping')}
        </Button>
      </CodeMappingButtonContainer>
    );
  }
  renderMatchWithUrl(config: RepositoryProjectPathConfig, url: string) {
    url = `${url}#L${this.props.frame.lineNo}`;
    return (
      <OpenInContainer columnQuantity={2}>
        <div>{t('Open this line in')}</div>
        <OpenInLink onClick={() => this.onOpenLink()} href={url} openInNewTab>
          {getIntegrationIcon(config.provider.key)}
          <OpenInName>{config.provider.name}</OpenInName>
        </OpenInLink>
      </OpenInContainer>
    );
  }
  renderBody() {
    const {config, sourceUrl} = this.match || {};
    if (config && sourceUrl) {
      return this.renderMatchWithUrl(config, sourceUrl);
    } else if (config) {
      return this.renderMatchNoUrl();
    } else {
      return this.renderNoMatch();
    }
  }
}

export default withProjects(withOrganization(StacktraceLink));
export {StacktraceLink};

export const CodeMappingButtonContainer = styled(OpenInContainer)`
  justify-content: space-between;
`;

const SourceCodeInput = styled('div')`
  display: grid;
  grid-template-columns: 5fr 1fr;
  grid-gap: ${space(1)};
`;

const ManualSetup = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  justify-items: center;
`;

const ModalContainer = styled('div')`
  display: grid;
  grid-gap: ${space(3)};
`;

const StyledInputField = styled(InputField)`
  padding: 0px;
`;

const IntegrationName = styled('p')`
  padding-left: 10px;
`;
