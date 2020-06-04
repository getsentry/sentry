import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {Organization, Project, Release} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import TextBlock from 'app/views/settings/components/text/textBlock';
import SearchBar from 'app/components/searchBar';
import Pagination from 'app/components/pagination';
import {PanelTable} from 'app/components/panels';
import space from 'app/styles/space';

import SourceMapsGroupRow from './sourceMapsGroupRow';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  groups: Release[];
};

class ProjectSourceMaps extends AsyncView<Props, State> {
  getTitle() {
    const {projectId} = this.props.params;

    return routeTitleGen(t('Source Maps'), projectId, false);
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      groups: [],
    };
  }

  getEndpoints() {
    const {params, location} = this.props;
    const {orgId, projectId} = params;

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      [
        'groups',
        `/projects/${orgId}/${projectId}/files/source-maps/`,
        {query: {query: location.query.query}},
      ],
    ];

    return endpoints;
  }

  handleSearch = (query: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, query},
    });
  };

  getQuery() {
    const {query} = this.props.location.query;

    return typeof query === 'string' ? query : undefined;
  }

  getEmptyMessage() {
    if (this.getQuery()) {
      return t('There are no source maps that match your search.');
    }

    return t('There are no source maps for this project.');
  }

  renderLoading() {
    return this.renderBody();
  }

  renderMappings() {
    const {groups} = this.state;
    const {params} = this.props;
    const {orgId, projectId} = params;

    if (!groups.length) {
      return null;
    }

    return groups.map(({version, dateCreated, fileCount}) => {
      return (
        <SourceMapsGroupRow
          key={version}
          name={version}
          date={dateCreated}
          fileCount={fileCount!}
          orgId={orgId}
          projectId={projectId}
        />
      );
    });
  }

  renderBody() {
    const {loading, groups, groupsPageLinks} = this.state;

    return (
      <React.Fragment>
        <SettingsPageHeader title={t('Source Maps')} />

        <TextBlock>
          {t(
            `Source Maps lets you view source code context obtained from stack traces in their original un-transformed form, which is particularly useful for debugging minified code, or transpiled code from a higher-level language.
            `
          )}
        </TextBlock>

        <Wrapper>
          <TextBlock noMargin>{t('Uploaded source maps')}:</TextBlock>

          <SearchBar
            placeholder={t('Search source maps')}
            onSearch={this.handleSearch}
            query={this.getQuery()}
          />
        </Wrapper>

        <StyledPanelTable
          headers={[
            t('Release'),
            t('Source Maps'),
            <Actions key="actions">{t('Actions')}</Actions>,
          ]}
          emptyMessage={this.getEmptyMessage()}
          isEmpty={groups.length === 0}
          isLoading={loading}
        >
          {this.renderMappings()}
        </StyledPanelTable>
        <Pagination pageLinks={groupsPageLinks} />
      </React.Fragment>
    );
  }
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 37% 1fr auto;
`;

const Actions = styled('div')`
  text-align: right;
`;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: auto minmax(200px, 400px);
  grid-gap: ${space(4)};
  align-items: center;
  margin-top: ${space(4)};
  margin-bottom: ${space(1)};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
  }
`;

export default ProjectSourceMaps;
