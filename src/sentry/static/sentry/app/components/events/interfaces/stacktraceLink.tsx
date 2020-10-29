import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import ExternalLink from 'app/components/links/externalLink';
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
  renderNoMatch() {
    return null;
  }
  renderMatchNoUrl(config: RepositoryProjectPathConfig) {
    return null;
  }
  renderMatchWithUrl(config: RepositoryProjectPathConfig, url: string) {
    return (
      <OpenInContainer>
        <div>{t('Open this line in')}</div>
        <OpenInLink href={url} openInNewTab>
          {getIntegrationIcon(config.provider)}
          <OpenInName>{config.providerName}</OpenInName>
        </OpenInLink>
      </OpenInContainer>
    );
  }
  render() {
    const {config, sourceUrl} = this.match || {};
    if (config && sourceUrl) {
      return this.renderMatchWithUrl(config, sourceUrl);
    } else if (config) {
      return this.renderMatchNoUrl(config);
    } else {
      return this.renderNoMatch();
    }
  }
}

export default withProjects(withOrganization(StacktraceLink));

const OpenInContainer = styled('div')`
  position: relative;
  z-index: 1;
  display: flex;
  color: ${p => p.theme.gray600};
  background-color: ${p => p.theme.white};
  font-family: ${p => p.theme.text.family};
  border-bottom: 1px solid ${p => p.theme.borderLight};
  padding: ${space(0.25)} ${space(3)};
  box-shadow: ${p => p.theme.dropShadowLightest};
  text-indent: initial;
  overflow: auto;
  white-space: nowrap;
`;

const OpenInLink = styled(ExternalLink)`
  align-items: center;
  color: ${p => p.theme.gray500};
  margin-left: ${space(1)};
`;

const OpenInName = styled('strong')`
  color: ${p => p.theme.gray600};
  font-weight: 700;
  margin-left: ${space(0.75)};
`;
