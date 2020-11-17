import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';
import {
  Frame,
  RepositoryProjectPathConfig,
  Organization,
  Event,
  Project,
} from 'app/types';
import {getIntegrationIcon} from 'app/utils/integrationUtil';

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
  config?: RepositoryProjectPathConfig;
  sourceUrl?: string;
  error?: string;
};

type State = AsyncComponent['state'] & {
  match: StacktraceResultItem;
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
  renderLoading() {
    //TODO: Add loading
    return null;
  }
  renderNoMatch() {
    //TODO: Improve UI
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
        <Button to={url} size="xsmall">
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
        <OpenInLink href={url} openInNewTab>
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

export const CodeMappingButtonContainer = styled(OpenInContainer)`
  justify-content: space-between;
`;
