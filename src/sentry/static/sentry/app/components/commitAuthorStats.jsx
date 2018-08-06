import PropTypes from 'prop-types';
import React from 'react';
import {Flex} from 'grid-emotion';
import createReactClass from 'create-react-class';

import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingError from 'app/components/loadingError';
import Avatar from 'app/components/avatar';
import Tooltip from 'app/components/tooltip';

import ApiMixin from 'app/mixins/apiMixin';

import {t} from 'app/locale';
import {Panel, PanelItem, PanelBody} from 'app/components/panels';

class CommitBar extends React.Component {
  static propTypes = {
    totalCommits: PropTypes.number.isRequired,
    authorCommits: PropTypes.number.isRequired,
  };

  render() {
    let barStyle = {};
    barStyle.width = this.props.authorCommits / this.props.totalCommits * 100 + '%';

    return <div className="commit-bar" style={barStyle} />;
  }
}

const CommitAuthorStats = createReactClass({
  displayName: 'CommitAuthorStats',

  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    version: PropTypes.string.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
    };
  },

  componentDidMount() {
    let {orgId, projectId, version} = this.props;
    let path = `/projects/${orgId}/${projectId}/releases/${encodeURIComponent(
      version
    )}/commits/`;
    this.api.request(path, {
      method: 'GET',
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

  renderEmpty() {
    return <div className="box empty">{t('No authors in this release')}</div>;
  },

  render() {
    if (this.state.loading) return <LoadingIndicator />;

    if (this.state.error) return <LoadingError />;

    let {commitList} = this.state;

    let commitAuthors = commitList.reduce((_commitAuthors, commit) => {
      let {author} = commit;
      if (!_commitAuthors.hasOwnProperty(author.email)) {
        _commitAuthors[author.email] = {
          commitCount: 1,
          author,
        };
      } else {
        _commitAuthors[author.email].commitCount += 1;
      }
      return _commitAuthors;
    }, {});

    let commitAuthorValues = Object.values(commitAuthors);

    // sort commitAuthors by highest commitCount to lowest commitCount
    commitAuthorValues.sort((a, b) => {
      return b.commitCount - a.commitCount;
    });

    return (
      <div style={{marginTop: 5}}>
        <h6 className="nav-header m-b-1">{t('Commits by Author')}</h6>
        {!commitAuthorValues.length && this.renderEmpty()}
        <Panel>
          <PanelBody>
            {commitAuthorValues.map((commitAuthor, i) => {
              let {author, commitCount} = commitAuthor;
              return (
                <PanelItem key={i} p={1} align="center">
                  <Flex>
                    <Tooltip title={`${author.name} ${author.email}`}>
                      <Avatar user={author} size={20} />
                    </Tooltip>
                  </Flex>
                  <Flex flex="1" px={1}>
                    <CommitBar
                      style={{marginLeft: 5}}
                      totalCommits={commitList.length}
                      authorCommits={commitCount}
                    />
                  </Flex>
                  <div>{commitCount}</div>
                </PanelItem>
              );
            })}
          </PanelBody>
        </Panel>
      </div>
    );
  },
});

export default CommitAuthorStats;
