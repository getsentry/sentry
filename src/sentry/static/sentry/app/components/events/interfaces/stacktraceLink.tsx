import React from 'react';

import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
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

type StacktraceResultItem = {
  config?: RepositoryProjectPathConfig;
  sourceUrl?: string;
};

type State = AsyncComponent['state'] & {
  match?: StacktraceResultItem;
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
    return this.match?.config;
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, frame} = this.props;
    const project = this.project;
    if (!project) {
      throw new Error('Unable to find project');
    }
    return [
      [
        'match',
        `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
        {query: {file: frame.filename}},
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
    //TODO: Improve UI
    return <OpenInContainer columnQuantity={2}>No Match</OpenInContainer>;
  }
  renderMatchWithUrl(config: RepositoryProjectPathConfig, url: string) {
    return (
      <OpenInContainer columnQuantity={2}>
        <div>{t('Open this line in')}</div>
        <OpenInLink href={url} openInNewTab>
          {getIntegrationIcon(config.provider)}
          <OpenInName>{config.providerName}</OpenInName>
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
