import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Button from 'app/components/button';
import GroupList from 'app/views/releases/detail/groupList';
import space from 'app/styles/space';
import {Panel} from 'app/components/panels';
import EventView from 'app/views/eventsV2/eventView';
import {formatVersion} from 'app/utils/formatters';

type Props = {
  orgId: string;
  version: string;
};

type State = {
  issuesType: string;
};

class Issues extends React.Component<Props, State> {
  // TODO(releasesV2): we may want to put this in the URL, for now it stays just in state (issues stream is still subject to change)
  state = {
    issuesType: 'new',
  };

  // TODO(releasesV2): figure out the query we want + do we want to pass globalSelectionHeader values?
  getDiscoverUrl() {
    const {version, orgId} = this.props;

    const discoverQuery = {
      id: undefined,
      version: 2,
      name: `${t('Release')} ${formatVersion(version)}`,
      fields: ['title', 'count(id)', 'event.type', 'user', 'last_seen'],
      query: `release:${version}`,

      projects: [],
      range: '',
      start: '',
      end: '',
      environment: [''],
    } as const;

    const discoverView = EventView.fromSavedQuery(discoverQuery);
    return discoverView.getResultsViewUrlTarget(orgId);
  }

  getIssuesEndpoint(): {path: string; query: string} {
    const {version, orgId} = this.props;
    const {issuesType} = this.state;

    switch (issuesType) {
      case 'all':
        return {path: `/organizations/${orgId}/issues/`, query: `release:"${version}"`};
      case 'resolved':
        return {
          path: `/organizations/${orgId}/releases/${version}/resolved/`,
          query: '',
        };
      case 'new':
      default:
        return {
          path: `/organizations/${orgId}/issues/`,
          query: `first-release:"${version}"`,
        };
    }
  }

  handleIssuesTypeSelection = (issuesType: string) => {
    this.setState({issuesType});
  };

  renderFilterLabel(label: string | undefined) {
    return (
      <React.Fragment>
        <LabelText>{t('Filter')}: &nbsp; </LabelText>
        {label}
      </React.Fragment>
    );
  }

  render() {
    const {issuesType} = this.state;
    const {orgId} = this.props;
    const {path, query} = this.getIssuesEndpoint();
    const issuesTypes = [
      {value: 'new', label: t('New Issues')},
      {value: 'resolved', label: t('Resolved Issues')},
      {value: 'all', label: t('All Issues')},
    ];

    return (
      <React.Fragment>
        <ControlsWrapper>
          <DropdownControl
            label={this.renderFilterLabel(
              issuesTypes.find(i => i.value === issuesType)?.label
            )}
          >
            {issuesTypes.map(({value, label}) => (
              <DropdownItem
                key={value}
                onSelect={this.handleIssuesTypeSelection}
                eventKey={value}
                isActive={value === issuesType}
              >
                {label}
              </DropdownItem>
            ))}
          </DropdownControl>

          <Button to={this.getDiscoverUrl()}>{t('Open in Discover')}</Button>
        </ControlsWrapper>

        <TableWrapper>
          <GroupList
            orgId={orgId}
            endpointPath={path}
            query={query}
            canSelectGroups={false}
            withChart={false}
          />
        </TableWrapper>
      </React.Fragment>
    );
  }
}

const ControlsWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

const TableWrapper = styled('div')`
  margin-bottom: ${space(3)};
  ${Panel} {
    /* smaller space between table and pagination */
    margin-bottom: -${space(1)};
  }
`;

const LabelText = styled('em')`
  font-style: normal;
  color: ${p => p.theme.gray2};
`;

export default Issues;
