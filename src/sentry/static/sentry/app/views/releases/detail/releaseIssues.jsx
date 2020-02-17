import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import IssueList from 'app/components/issueList';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import space from 'app/styles/space';
import {t} from 'app/locale';

export default class ReleaseIssues extends React.Component {
  static propTypes = {
    query: PropTypes.object.isRequired,
    version: PropTypes.string.isRequired,
    orgId: PropTypes.string.isRequired,
  };

  render() {
    const {version, orgId, query} = this.props;

    const resolvedPath = `/organizations/${orgId}/releases/${encodeURIComponent(
      version
    )}/resolved/`;

    const issuesPath = `/organizations/${orgId}/issues/`;

    return (
      <React.Fragment>
        <h5>{t('Issues Resolved in this Release')}</h5>
        <StyledIssueList
          endpoint={resolvedPath}
          query={query}
          pagination={false}
          renderEmpty={() => (
            <Panel>
              <PanelBody>
                <PanelItem justifyContent="center">{t('No issues resolved')}</PanelItem>
              </PanelBody>
            </Panel>
          )}
          showActions={false}
          params={{orgId}}
        />
        <h5>{t('New Issues in this Release')}</h5>
        <StyledIssueList
          endpoint={issuesPath}
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
                <PanelItem justifyContent="center">{t('No new issues')}</PanelItem>
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
