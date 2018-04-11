import React from 'react';

import createReactClass from 'create-react-class';

import LoadingIndicator from '../../components/loadingIndicator';
import LoadingError from '../../components/loadingError';
import DropdownLink from '../../components/dropdownLink';
import MenuItem from '../../components/menuItem';
import ApiMixin from '../../mixins/apiMixin';
import CommitRow from '../../components/commitRow';
import {Panel, PanelHeader, PanelBody} from '../../components/panels';
import {t} from '../../locale';
import EmptyStateWarning from '../../components/emptyStateWarning';

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
    let {orgId, projectId, version} = this.props.params;

    let path = `/projects/${orgId}/${projectId}/releases/${encodeURIComponent(
      version
    )}/commits/`;
    this.api.request(path, {
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
    let {commitList} = this.state;
    let commitsByRepository = commitList.reduce(function(cbr, commit) {
      let {repository} = commit;
      if (!cbr.hasOwnProperty(repository.name)) {
        cbr[repository.name] = [];
      }

      cbr[repository.name].push(commit);
      return cbr;
    }, {});
    return commitsByRepository;
  },

  renderCommitsForRepo(repo) {
    let commitsByRepository = this.getCommitsByRepository();
    let activeCommits = commitsByRepository[repo];

    return (
      <Panel>
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

    let {commitList, activeRepo} = this.state;

    if (!commitList.length) return <this.emptyState />;
    let commitsByRepository = this.getCommitsByRepository();
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
