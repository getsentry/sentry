import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import {Organization, Project, SourceMapsArchive} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import TextBlock from 'app/views/settings/components/text/textBlock';
import SearchBar from 'app/components/searchBar';
import Pagination from 'app/components/pagination';
import {PanelTable} from 'app/components/panels';
import space from 'app/styles/space';

import SourceMapsArchiveRow from './sourceMapsArchiveRow';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

type State = AsyncView['state'] & {
  archives: SourceMapsArchive[];
};

class ProjectSourceMaps extends AsyncView<Props, State> {
  getTitle() {
    const {projectId} = this.props.params;

    return routeTitleGen(t('Source Maps'), projectId, false);
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      archives: [],
    };
  }

  getEndpoints() {
    const {params, location} = this.props;
    const {orgId, projectId} = params;

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      [
        'archives',
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
      return t('There are no archives that match your search.');
    }

    return t('There are no archives for this project.');
  }

  renderLoading() {
    return this.renderBody();
  }

  renderMappings() {
    const {archives} = this.state;
    const {params} = this.props;
    const {orgId, projectId} = params;

    if (!archives.length) {
      return null;
    }

    return archives.map(({name, date, fileCount}) => {
      return (
        <SourceMapsArchiveRow
          key={name}
          name={name}
          date={date}
          fileCount={fileCount}
          orgId={orgId}
          projectId={projectId}
        />
      );
    });
  }

  renderBody() {
    const {loading, archives, archivesPageLinks} = this.state;

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
          <TextBlock noMargin>{t('Uploaded archives')}:</TextBlock>

          <SearchBar
            placeholder={t('Filter archives')}
            onSearch={this.handleSearch}
            query={this.getQuery()}
          />
        </Wrapper>

        <StyledPanelTable
          headers={[
            t('Archive'),
            t('Artifacts'),
            <Actions key="actions">{t('Actions')}</Actions>,
          ]}
          emptyMessage={this.getEmptyMessage()}
          isEmpty={archives.length === 0}
          isLoading={loading}
        >
          {this.renderMappings()}
        </StyledPanelTable>
        <Pagination pageLinks={archivesPageLinks} />
      </React.Fragment>
    );
  }
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 100px 200px;
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
