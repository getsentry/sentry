import {Box, Flex} from 'grid-emotion';
import React from 'react';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import ActionLink from 'app/components/actions/actionLink';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import FileSize from 'app/components/fileSize';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import OrganizationState from 'app/mixins/organizationState';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import TimeSince from 'app/components/timeSince';
import Pagination from 'app/components/pagination';
import SearchBar from 'app/components/searchBar';
import LinkWithConfirmation from 'app/components/linkWithConfirmation';

const ProjectDebugSymbols = createReactClass({
  displayName: 'ProjectDebugSymbols',
  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      showModal: false,
      debugFiles: [],
      activeAppID: null,
      activeVersion: null,
      activeBuilds: null,
      activeBuild: null,
      activeDsyms: null,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/files/dsyms/`, {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          debugFiles: data.debugFiles,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  renderLoading() {
    return <LoadingIndicator />;
  },

  renderNoQueryResults() {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no releases match your filters.')}</p>
      </EmptyStateWarning>
    );
  },

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t('There are no debug symbols for this project.')}</p>
      </EmptyStateWarning>
    );
  },

  renderDsyms() {
    let {orgId, projectId} = this.props.params;
    let access = this.getAccess();

    const rows = this.state.debugFiles.map((dsym, key) => {
      const url = `${this.api
        .baseUrl}/projects/${orgId}/${projectId}/files/dsyms/?download_id=${dsym.id}`;
      return (
        <PanelItem key={key} align="center" px={2} py={1}>
          <Box w={5 / 12} pl={2}>
            <p className="m-b-0 small">{dsym.debugId || dsym.uuid}</p>
            <Flex align="center">
              <Box w={6 / 12}>
                <p className="m-b-0 text-light small">
                  <span className="icon icon-clock" />{' '}
                  <TimeSince date={dsym.dateCreated} />
                </p>
              </Box>
              <Box w={6 / 12}>
                <p className="m-b-0 text-light small">
                  <FileSize bytes={dsym.size} />
                </p>
              </Box>
            </Flex>
          </Box>
          <Box flex="1">
            {dsym.symbolType === 'proguard' && dsym.objectName === 'proguard-mapping'
              ? '-'
              : dsym.objectName}
            <p className="m-b-0 text-light small">
              {dsym.symbolType === 'proguard' && dsym.cpuName === 'any'
                ? 'proguard'
                : `${dsym.cpuName} (${dsym.symbolType})`}
            </p>
          </Box>

          <Box flex="1">
            {access.has('project:write') ? (
              <div className="btn-group">
                <ActionLink
                  onAction={() => this.download(url)}
                  className="btn btn-default btn-sm"
                >
                  {t('Download')}
                </ActionLink>
                <LinkWithConfirmation
                  className="btn btn-danger btn-sm"
                  title={t('Delete')}
                  message={t(
                    'Are you sure you wish to delete this debug infromation file?'
                  )}
                  onConfirm={() => this.onDelete(row.id)}
                >
                  {t('Delete')}
                </LinkWithConfirmation>
              </div>
            ) : null}
          </Box>
        </PanelItem>
      );
    });

    return rows;
  },

  renderStreamBody() {
    let body;

    let params = this.props.params;

    if (this.state.loading) body = this.renderLoading();
    else if (this.state.error) body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.debugFiles.length > 0) body = this.renderDsyms();
    else if (this.state.query && this.state.query !== DEFAULT_QUERY)
      body = this.renderNoQueryResults();
    else body = this.renderEmpty();

    return body;
  },

  render() {
    return (
      <div>
        <SettingsPageHeader title={t('Debug Information Files')} />
        <TextBlock>
          {t(
            `
          Here you can find all your uploaded debug information files (for instance debug
          symbol files or proguard mappings).  This is used to convert
          addresses and minified function names from crash dumps
          into function names and locations.  For JavaScript debug support
          look at releases instead.
        `
          )}
        </TextBlock>

        <div className="ref-project-releases">
          <div className="row release-list-header">
            <div className="col-sm-7" />
            <div className="col-sm-5 release-search">
              <SearchBar
                defaultQuery=""
                placeholder={t('Search for a DIF')}
                query={this.state.query}
                onSearch={this.onSearch}
              />
            </div>
          </div>
          <Panel>
            <PanelHeader>
              <Box w={5 / 12} pl={2}>
                {t('Debug ID')}
              </Box>
              <Box flex="1">{t('Name')}</Box>
              <Box flex="1" />
            </PanelHeader>
            <PanelBody>{this.renderDsyms()}</PanelBody>
          </Panel>
          <Pagination pageLinks={this.state.pageLinks} />
        </div>
      </div>
    );
  },
});

export default ProjectDebugSymbols;

const BuildLabel = styled('div')`
  margin-bottom: 4px;
`;
