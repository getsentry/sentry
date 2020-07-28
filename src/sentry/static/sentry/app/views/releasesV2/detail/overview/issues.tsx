import React from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';
import {Location} from 'history';

import {t, tct} from 'app/locale';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Button from 'app/components/button';
import DiscoverButton from 'app/components/discoverButton';
import GroupList from 'app/components/issues/groupList';
import space from 'app/styles/space';
import {Panel, PanelBody} from 'app/components/panels';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {DEFAULT_RELATIVE_PERIODS} from 'app/constants';
import {GlobalSelection} from 'app/types';
import Feature from 'app/components/acl/feature';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import ButtonBar from 'app/components/buttonBar';
import {stringifyQueryObject, QueryResults} from 'app/utils/tokenizeSearch';

import {getReleaseEventView} from './chart/utils';

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
    const discoverView = getReleaseEventView(selection, version);

    return discoverView.getResultsViewUrlTarget(orgId);
  }

  getIssuesUrl() {
    const {version, orgId} = this.props;
    const {issuesType} = this.state;
    const {queryParams} = this.getIssuesEndpoint();
    const query = new QueryResults([]);

    if (issuesType === IssuesType.NEW) {
      query.setTag('firstRelease', [version]);
    } else {
      query.setTag('release', [version]);
    }

    return {
      pathname: `/organizations/${orgId}/issues/`,
      query: {
        ...queryParams,
        query: stringifyQueryObject(query),
      },
    };
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
            buttonProps={{prefix: t('Filter'), size: 'small'}}
            label={issuesTypes.find(i => i.value === issuesType)?.label}
          >
            {issuesTypes.map(({value, label}) => (
              <StyledDropdownItem
                key={value}
                onSelect={this.handleIssuesTypeSelection}
                eventKey={value}
                isActive={value === issuesType}
              >
                {label}
              </StyledDropdownItem>
            ))}
          </DropdownControl>

          <OpenInButtonBar gap={1}>
            <Feature features={['discover-basic']}>
              <DiscoverButton to={this.getDiscoverUrl()} size="small">
                {t('Open in Discover')}
              </DiscoverButton>
            </Feature>

            <Button to={this.getIssuesUrl()} size="small">
              {t('Open in Issues')}
            </Button>
          </OpenInButtonBar>
        </ControlsWrapper>
        <TableWrapper data-test-id="release-wrapper">
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

const ControlsWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(1)};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
  }
`;

const OpenInButtonBar = styled(ButtonBar)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    margin-top: ${space(1)};
  }
`;

const StyledDropdownItem = styled(DropdownItem)`
  white-space: nowrap;
`;

const TableWrapper = styled('div')`
  margin-bottom: ${space(4)};
  ${Panel} {
    /* smaller space between table and pagination */
    margin-bottom: -${space(1)};
  }
`;

export default Issues;
