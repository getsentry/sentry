import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import IssueList from 'app/components/issueList';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import space from 'app/styles/space';
import {t} from 'app/locale';

export default class ReleaseIssues extends React.Component {
  static propTypes = {
    query: PropTypes.object.isRequired,
    version: PropTypes.string.isRequired,
    orgId: PropTypes.string.isRequired,
    // Provided only in the project version of release issues
    projectId: PropTypes.string,
  };

  getResolvedPath() {
    const {version, orgId, projectId} = this.props;

    return projectId
      ? `/projects/${orgId}/${projectId}/releases/${encodeURIComponent(
          version
        )}/resolved/`
      : `/organizations/${orgId}/releases/${encodeURIComponent(version)}/resolved/`;
  }

  getIssuesPath() {
    const {orgId, projectId} = this.props;

    return projectId
      ? `/projects/${orgId}/${projectId}/issues/`
      : `/organizations/${orgId}/issues/`;
  }

  render() {
    const {version, orgId, query} = this.props;

    return (
      <React.Fragment>
        <h5>{t('Issues Resolved in this Release')}</h5>
        <StyledIssueList
          endpoint={this.getResolvedPath()}
          query={query}
          pagination={false}
          renderEmpty={() => (
            <Panel>
              <PanelBody>
                <PanelItem justify="center">{t('No issues resolved')}</PanelItem>
              </PanelBody>
            </Panel>
          )}
          showActions={false}
          params={{orgId}}
        />
        <h5>{t('New Issues in this Release')}</h5>
        <StyledIssueList
          endpoint={this.getIssuesPath()}
          query={{
            ...query,
            query: 'first-release:"' + version + '"',
            limit: 5,
          }}
          statsPeriod="0"
          pagination={false}
          renderEmpty={() => (
            <Panel>
              <PanelBody>
                <PanelItem justify="center">{t('No new issues')}</PanelItem>
              </PanelBody>
            </Panel>
          )}
          showActions={false}
          params={{orgId}}
        />
      </React.Fragment>
    );
  }
}

const StyledIssueList = styled(IssueList)`
  margin-bottom: ${space(2)};
`;
