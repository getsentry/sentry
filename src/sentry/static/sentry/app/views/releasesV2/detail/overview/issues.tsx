import React from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';
import {Location} from 'history';

import {t, tct} from 'app/locale';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Button from 'app/components/button';
import GroupList from 'app/views/releases/detail/groupList';
import space from 'app/styles/space';
import {Panel, PanelBody} from 'app/components/panels';
import EventView from 'app/utils/discover/eventView';
import {formatVersion} from 'app/utils/formatters';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {DEFAULT_RELATIVE_PERIODS} from 'app/constants';
import {GlobalSelection} from 'app/types';
import Feature from 'app/components/acl/feature';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {getUtcDateString} from 'app/utils/dates';
import DropdownButton from 'app/components/dropdownButton';

enum IssuesType {
  NEW = 'new',
  RESOLVED = 'resolved',
  ALL = 'all',
}

type IssuesQueryParams = {
  limit: number;
  sort: string;
  query: string;
};

type Props = {
  orgId: string;
  version: string;
  selection: GlobalSelection;
  location: Location;
};

type State = {
  issuesType: IssuesType;
};

class Issues extends React.Component<Props, State> {
  state: State = {
    issuesType: IssuesType.NEW,
  };

  getDiscoverUrl() {
    const {version, orgId, selection} = this.props;
    const {projects, environments, datetime} = selection;
    const {start, end, period} = datetime;

    const discoverQuery = {
      id: undefined,
      version: 2,
      name: `${t('Release')} ${formatVersion(version)}`,
      fields: ['title', 'count()', 'event.type', 'issue', 'last_seen()'],
      query: `release:${version} !event.type:transaction`,
      orderby: '-last_seen',
      range: period,
      environments,
      projects,
      start: start ? getUtcDateString(start) : undefined,
      end: end ? getUtcDateString(end) : undefined,
    } as const;

    const discoverView = EventView.fromSavedQuery(discoverQuery);
    return discoverView.getResultsViewUrlTarget(orgId);
  }

  getIssuesEndpoint(): {path: string; queryParams: IssuesQueryParams} {
    const {version, orgId, location} = this.props;
    const {issuesType} = this.state;
    const queryParams = {
      ...pick(location.query, [...Object.values(URL_PARAM), 'cursor']),
      limit: 50,
      sort: 'new',
    };

    switch (issuesType) {
      case IssuesType.ALL:
        return {
          path: `/organizations/${orgId}/issues/`,
          queryParams: {...queryParams, query: `release:"${version}"`},
        };
      case IssuesType.RESOLVED:
        return {
          path: `/organizations/${orgId}/releases/${version}/resolved/`,
          queryParams: {...queryParams, query: ''},
        };
      case IssuesType.NEW:
      default:
        return {
          path: `/organizations/${orgId}/issues/`,
          queryParams: {...queryParams, query: `first-release:"${version}"`},
        };
    }
  }

  handleIssuesTypeSelection = (issuesType: IssuesType) => {
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

  renderEmptyMessage = () => {
    const {selection} = this.props;
    const {issuesType} = this.state;

    const selectedTimePeriod = DEFAULT_RELATIVE_PERIODS[selection.datetime.period];
    const displayedPeriod = selectedTimePeriod
      ? selectedTimePeriod.toLowerCase()
      : t('given timeframe');

    return (
      <Panel>
        <PanelBody>
          <EmptyStateWarning small withIcon={false}>
            {issuesType === IssuesType.NEW &&
              tct('No new issues in this release for the [timePeriod].', {
                timePeriod: displayedPeriod,
              })}
            {issuesType === IssuesType.RESOLVED &&
              t('No resolved issues in this release.')}
            {issuesType === IssuesType.ALL &&
              tct('No issues in this release for the [timePeriod].', {
                timePeriod: displayedPeriod,
              })}
          </EmptyStateWarning>
        </PanelBody>
      </Panel>
    );
  };

  render() {
    const {issuesType} = this.state;
    const {orgId} = this.props;
    const {path, queryParams} = this.getIssuesEndpoint();
    const issuesTypes = [
      {value: 'new', label: t('New Issues')},
      {value: 'resolved', label: t('Resolved Issues')},
      {value: 'all', label: t('All Issues')},
    ];

    return (
      <React.Fragment>
        <ControlsWrapper>
          <DropdownControl
            button={({getActorProps}) => (
              <FilterButton {...getActorProps()} isOpen={false}>
                {this.renderFilterLabel(
                  issuesTypes.find(i => i.value === issuesType)?.label
                )}
              </FilterButton>
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

          <Feature features={['discover-basic']}>
            <DiscoverButton to={this.getDiscoverUrl()}>
              {t('Open in Discover')}
            </DiscoverButton>
          </Feature>
        </ControlsWrapper>

        <TableWrapper>
          <GroupList
            orgId={orgId}
            endpointPath={path}
            queryParams={queryParams}
            query=""
            canSelectGroups={false}
            withChart={false}
            renderEmptyMessage={this.renderEmptyMessage}
          />
        </TableWrapper>
      </React.Fragment>
    );
  }
}

const FilterButton = styled(DropdownButton)``;
const DiscoverButton = styled(Button)``;

const ControlsWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    ${FilterButton}, ${DiscoverButton} {
      font-size: ${p => p.theme.fontSizeSmall};
    }
  }
`;

const TableWrapper = styled('div')`
  margin-bottom: ${space(4)};
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
