import React from 'react';

import createReactClass from 'create-react-class';

import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingError from 'app/components/loadingError';
import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';
import ApiMixin from 'app/mixins/apiMixin';
import CommitRow from 'app/components/commitRow';
import {Panel, PanelHeader, PanelBody} from 'app/components/panels';
import {t} from 'app/locale';
import EmptyStateWarning from 'app/components/emptyStateWarning';

const ReleaseCommits = createReactClass({
  displayName: 'ReleaseCommits',
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      commitList: [],
      activeRepo: null,
    };
  },

  componentDidMount() {
    this.api.request(this.getPath(), {
      method: 'GET',
      data: this.props.location.query,
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          commitList: data,
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

  getPath() {
    const {orgId, projectId, version} = this.props.params;

    const encodedVersion = encodeURIComponent(version);

    return projectId
      ? `/projects/${orgId}/${projectId}/releases/${encodedVersion}/commits/`
      : `/organizations/${orgId}/releases/${encodedVersion}/commits/`;
  },

  emptyState() {
    return (
      <Panel>
        <EmptyStateWarning>
          <p>{t('There are no commits associated with this release.')}</p>
          {/* Todo: Should we link to repo settings from here?  */}
        </EmptyStateWarning>
      </Panel>
    );
  },

  setActiveRepo(repo) {
    this.setState({
      activeRepo: repo,
    });
  },

  getCommitsByRepository() {
    const {commitList} = this.state;
    const commitsByRepository = commitList.reduce(function(cbr, commit) {
      const {repository} = commit;
      if (!cbr.hasOwnProperty(repository.name)) {
        cbr[repository.name] = [];
      }

      cbr[repository.name].push(commit);
      return cbr;
    }, {});
    return commitsByRepository;
  },

  renderCommitsForRepo(repo) {
    const commitsByRepository = this.getCommitsByRepository();
    const activeCommits = commitsByRepository[repo];

    return (
      <Panel key={repo}>
        <PanelHeader>{repo}</PanelHeader>
        <PanelBody>
          {activeCommits.map(commit => {
            return <CommitRow key={commit.id} commit={commit} />;
          })}
        </PanelBody>
      </Panel>
    );
  },

  render() {
    if (this.state.loading) return <LoadingIndicator />;

    if (this.state.error) return <LoadingError />;

    const {commitList, activeRepo} = this.state;

    if (!commitList.length) return <this.emptyState />;
    const commitsByRepository = this.getCommitsByRepository();
    return (
      <div>
        <div className="heading">
          {Object.keys(commitsByRepository).length > 1 ? (
            <div className="commits-dropdown align-left">
              <div className="commits-dropdowng">
                <DropdownLink
                  caret={true}
                  title={this.state.activeRepo || 'All Repositories'}
                >
                  <MenuItem
                    key="all"
                    noAnchor={true}
                    onClick={() => {
                      this.setActiveRepo(null);
                    }}
                    isActive={this.state.activeRepo === null}
                  >
                    <a>{t('All Repositories')}</a>
                  </MenuItem>
                  {Object.keys(commitsByRepository).map(repository => {
                    return (
                      <MenuItem
                        key={commitsByRepository[repository].id}
                        noAnchor={true}
                        onClick={() => {
                          this.setActiveRepo(repository);
                        }}
                        isActive={this.state.activeRepo === repository}
                      >
                        <a>{repository}</a>
                      </MenuItem>
                    );
                  })}
                </DropdownLink>
              </div>
            </div>
          ) : null}
        </div>
        {activeRepo
          ? this.renderCommitsForRepo(activeRepo)
          : Object.keys(commitsByRepository).map(repository => {
              return this.renderCommitsForRepo(repository);
            })}
      </div>
    );
  },
});

export default ReleaseCommits;
