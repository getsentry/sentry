import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import DiscoverButton from 'app/components/discoverButton';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import GroupList from 'app/components/issues/groupList';
import Pagination from 'app/components/pagination';
import {DEFAULT_RELATIVE_PERIODS} from 'app/constants';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import {QueryResults} from 'app/utils/tokenizeSearch';
import {IssueSortOptions} from 'app/views/issueList/utils';

import {getReleaseParams, ReleaseBounds} from '../../utils';
import EmptyState from '../emptyState';

import {getReleaseEventView} from './chart/utils';

enum IssuesType {
  NEW = 'new',
  UNHANDLED = 'unhandled',
  RESOLVED = 'resolved',
  ALL = 'all',
}

type IssuesQueryParams = {
  limit: number;
  sort: string;
  query: string;
};

const defaultProps = {
  withChart: false,
};

type Props = {
  organization: Organization;
  version: string;
  selection: GlobalSelection;
  location: Location;
  defaultStatsPeriod: string;
  releaseBounds: ReleaseBounds;
  queryFilterDescription?: string;
} & Partial<typeof defaultProps>;

type State = {
  issuesType: IssuesType;
  pageLinks?: string;
  onCursor?: () => void;
};

class Issues extends Component<Props, State> {
  static defaultProps = defaultProps;

  state: State = {
    issuesType: IssuesType.NEW,
  };

  getDiscoverUrl() {
    const {version, organization, selection} = this.props;
    const discoverView = getReleaseEventView(selection, version);

    return discoverView.getResultsViewUrlTarget(organization.slug);
  }

  getIssuesUrl() {
    const {version, organization} = this.props;
    const {issuesType} = this.state;
    const {queryParams} = this.getIssuesEndpoint();
    const query = new QueryResults([]);

    switch (issuesType) {
      case IssuesType.NEW:
        query.setTagValues('firstRelease', [version]);
        break;
      case IssuesType.UNHANDLED:
        query.setTagValues('release', [version]);
        query.setTagValues('error.handled', ['0']);
        break;
      case IssuesType.RESOLVED:
      case IssuesType.ALL:
      default:
        query.setTagValues('release', [version]);
    }

    return {
      pathname: `/organizations/${organization.slug}/issues/`,
      query: {
        ...queryParams,
        limit: undefined,
        cursor: undefined,
        query: query.formatString(),
      },
    };
  }

  getIssuesEndpoint(): {path: string; queryParams: IssuesQueryParams} {
    const {version, organization, location, defaultStatsPeriod, releaseBounds} =
      this.props;
    const {issuesType} = this.state;

    const queryParams = {
      ...getReleaseParams({
        location,
        releaseBounds,
        defaultStatsPeriod,
        allowEmptyPeriod: organization.features.includes('release-comparison'),
      }),
      limit: 10,
      sort: IssueSortOptions.FREQ,
      groupStatsPeriod: 'auto',
    };

    switch (issuesType) {
      case IssuesType.ALL:
        return {
          path: `/organizations/${organization.slug}/issues/`,
          queryParams: {
            ...queryParams,
            query: new QueryResults([`release:${version}`]).formatString(),
          },
        };
      case IssuesType.RESOLVED:
        return {
          path: `/organizations/${organization.slug}/releases/${version}/resolved/`,
          queryParams: {...queryParams, query: ''},
        };
      case IssuesType.UNHANDLED:
        return {
          path: `/organizations/${organization.slug}/issues/`,
          queryParams: {
            ...queryParams,
            query: new QueryResults([
              `release:${version}`,
              'error.handled:0',
            ]).formatString(),
          },
        };
      case IssuesType.NEW:
      default:
        return {
          path: `/organizations/${organization.slug}/issues/`,
          queryParams: {
            ...queryParams,
            query: new QueryResults([`first-release:${version}`]).formatString(),
          },
        };
    }
  }

  handleIssuesTypeSelection = (issuesType: IssuesType) => {
    this.setState({issuesType});
  };

  handleFetchSuccess = (groupListState, onCursor) => {
    this.setState({pageLinks: groupListState.pageLinks, onCursor});
  };

  renderEmptyMessage = () => {
    const {selection} = this.props;
    const {issuesType} = this.state;

    const selectedTimePeriod = DEFAULT_RELATIVE_PERIODS[selection.datetime.period];
    const displayedPeriod = selectedTimePeriod
      ? selectedTimePeriod.toLowerCase()
      : t('given timeframe');

    return (
      <EmptyState>
        <Fragment>
          {issuesType === IssuesType.NEW &&
            tct('No new issues for the [timePeriod].', {
              timePeriod: displayedPeriod,
            })}
          {issuesType === IssuesType.UNHANDLED &&
            tct('No unhandled issues for the [timePeriod].', {
              timePeriod: displayedPeriod,
            })}
          {issuesType === IssuesType.RESOLVED && t('No resolved issues.')}
          {issuesType === IssuesType.ALL &&
            tct('No issues for the [timePeriod].', {
              timePeriod: displayedPeriod,
            })}
        </Fragment>
      </EmptyState>
    );
  };

  render() {
    const {issuesType, pageLinks, onCursor} = this.state;
    const {organization, queryFilterDescription, withChart} = this.props;
    const {path, queryParams} = this.getIssuesEndpoint();
    const issuesTypes = [
      {value: IssuesType.NEW, label: t('New Issues')},
      {value: IssuesType.RESOLVED, label: t('Resolved Issues')},
      {value: IssuesType.UNHANDLED, label: t('Unhandled Issues')},
      {value: IssuesType.ALL, label: t('All Issues')},
    ];

    return (
      <Fragment>
        <ControlsWrapper>
          <DropdownControl
            button={({isOpen, getActorProps}) => (
              <StyledDropdownButton
                {...getActorProps()}
                isOpen={isOpen}
                prefix={t('Filter')}
                size="small"
              >
                {issuesTypes.find(i => i.value === issuesType)?.label}
              </StyledDropdownButton>
            )}
          >
            {issuesTypes.map(({value, label}) => (
              <StyledDropdownItem
                key={value}
                onSelect={this.handleIssuesTypeSelection}
                data-test-id={`filter-${value}`}
                eventKey={value}
                isActive={value === issuesType}
              >
                {label}
              </StyledDropdownItem>
            ))}
          </DropdownControl>

          <OpenInButtonBar gap={1}>
            <Button to={this.getIssuesUrl()} size="small" data-test-id="issues-button">
              {t('Open in Issues')}
            </Button>

            <GuideAnchor target="release_issues_open_in_discover">
              <DiscoverButton
                to={this.getDiscoverUrl()}
                size="small"
                data-test-id="discover-button"
              >
                {t('Open in Discover')}
              </DiscoverButton>
            </GuideAnchor>
            <StyledPagination pageLinks={pageLinks} onCursor={onCursor} />
          </OpenInButtonBar>
        </ControlsWrapper>
        <div data-test-id="release-wrapper">
          <GroupList
            orgId={organization.slug}
            endpointPath={path}
            queryParams={queryParams}
            query=""
            canSelectGroups={false}
            queryFilterDescription={queryFilterDescription}
            withChart={withChart}
            narrowGroups
            renderEmptyMessage={this.renderEmptyMessage}
            withPagination={false}
            onFetchSuccess={this.handleFetchSuccess}
          />
        </div>
      </Fragment>
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

const StyledDropdownButton = styled(DropdownButton)`
  min-width: 145px;
`;

const StyledDropdownItem = styled(DropdownItem)`
  white-space: nowrap;
`;

const StyledPagination = styled(Pagination)`
  margin: 0;
`;

export default Issues;
