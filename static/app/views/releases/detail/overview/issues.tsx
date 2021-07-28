import {Component, Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import * as qs from 'query-string';

import {Client} from 'app/api';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button, {ButtonLabel} from 'app/components/button';
import ButtonBar, {ButtonGrid} from 'app/components/buttonBar';
import DiscoverButton from 'app/components/discoverButton';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import GroupList from 'app/components/issues/groupList';
import Pagination from 'app/components/pagination';
import QueryCount from 'app/components/queryCount';
import {DEFAULT_RELATIVE_PERIODS} from 'app/constants';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import {QueryResults} from 'app/utils/tokenizeSearch';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
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

enum IssuesQuery {
  NEW = 'first-release',
  UNHANDLED = 'error.handled:0',
  RESOLVED = 'is:resolved',
  ALL = 'release',
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
  api: Client;
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
  count: {
    new: number | null;
    unhandled: number | null;
    resolved: number | null;
    all: number | null;
  };
  pageLinks?: string;
  onCursor?: () => void;
};

class Issues extends Component<Props, State> {
  static defaultProps = defaultProps;
  state: State = this.getInitialState();

  getInitialState() {
    const {location} = this.props;
    const query = location.query ? location.query.issuesType : null;
    const issuesTypeState = !query
      ? IssuesType.NEW
      : query.includes(IssuesType.NEW)
      ? IssuesType.NEW
      : query.includes(IssuesType.UNHANDLED)
      ? IssuesType.UNHANDLED
      : query.includes(IssuesType.RESOLVED)
      ? IssuesType.RESOLVED
      : query.includes(IssuesType.ALL)
      ? IssuesType.ALL
      : IssuesType.ALL;

    return {
      issuesType: issuesTypeState,
      count: {
        new: null,
        all: null,
        resolved: null,
        unhandled: null,
      },
    };
  }

  componentDidMount() {
    this.fetchIssuesCount();
  }

  componentDidUpdate(prevProps: Props) {
    if (
      !isEqual(
        getReleaseParams({
          location: this.props.location,
          releaseBounds: this.props.releaseBounds,
          defaultStatsPeriod: this.props.defaultStatsPeriod,
          allowEmptyPeriod:
            this.props.organization.features.includes('release-comparison'),
        }),
        getReleaseParams({
          location: prevProps.location,
          releaseBounds: prevProps.releaseBounds,
          defaultStatsPeriod: prevProps.defaultStatsPeriod,
          allowEmptyPeriod:
            prevProps.organization.features.includes('release-comparison'),
        })
      )
    ) {
      this.fetchIssuesCount();
    }
  }

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
            query: new QueryResults([`${IssuesQuery.ALL}:${version}`]).formatString(),
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
              `${IssuesQuery.ALL}:${version}`,
              IssuesQuery.UNHANDLED,
            ]).formatString(),
          },
        };
      case IssuesType.NEW:
      default:
        return {
          path: `/organizations/${organization.slug}/issues/`,
          queryParams: {
            ...queryParams,
            query: new QueryResults([`${IssuesQuery.NEW}:${version}`]).formatString(),
          },
        };
    }
  }

  async fetchIssuesCount() {
    const {api, organization, version} = this.props;
    const issueCountEndpoint = this.getIssueCountEndpoint();
    const resolvedEndpoint = `/organizations/${organization.slug}/releases/${version}/resolved/`;

    try {
      await Promise.all([
        api.requestPromise(issueCountEndpoint),
        api.requestPromise(resolvedEndpoint),
      ]).then(([issueResponse, resolvedResponse]) => {
        this.setState({
          count: {
            all: issueResponse[`${IssuesQuery.ALL}:"${version}"`] || 0,
            new: issueResponse[`${IssuesQuery.NEW}:"${version}"`] || 0,
            resolved: resolvedResponse.length,
            unhandled:
              issueResponse[`${IssuesQuery.UNHANDLED} ${IssuesQuery.ALL}:"${version}"`] ||
              0,
          },
        });
      });
    } catch {
      // do nothing
    }
  }

  getIssueCountEndpoint() {
    const {organization, version, location, releaseBounds, defaultStatsPeriod} =
      this.props;
    const issuesCountPath = `/organizations/${organization.slug}/issues-count/`;

    const params = [
      `${IssuesQuery.NEW}:"${version}"`,
      `${IssuesQuery.ALL}:"${version}"`,
      `${IssuesQuery.UNHANDLED} ${IssuesQuery.ALL}:"${version}"`,
    ];
    const queryParams = params.map(param => param);
    const queryParameters = {
      ...getReleaseParams({
        location,
        releaseBounds,
        defaultStatsPeriod,
        allowEmptyPeriod: organization.features.includes('release-comparison'),
      }),
      query: queryParams,
    };

    return `${issuesCountPath}?${qs.stringify(queryParameters)}`;
  }

  handleIssuesTypeSelection = (issuesType: IssuesType) => {
    const {location} = this.props;
    const issuesTypeQuery =
      issuesType === IssuesType.ALL
        ? IssuesType.ALL
        : issuesType === IssuesType.NEW
        ? IssuesType.NEW
        : issuesType === IssuesType.RESOLVED
        ? IssuesType.RESOLVED
        : issuesType === IssuesType.UNHANDLED
        ? IssuesType.UNHANDLED
        : '';

    const to = {
      ...location,
      query: {
        ...location.query,
        issuesType: issuesTypeQuery,
      },
    };

    browserHistory.replace(to);
    this.setState({issuesType});
  };

  handleFetchSuccess = (groupListState, onCursor) => {
    this.setState({pageLinks: groupListState.pageLinks, onCursor});
  };

  renderEmptyMessage = () => {
    const {location, releaseBounds, defaultStatsPeriod, organization} = this.props;
    const {issuesType} = this.state;
    const hasReleaseComparison = organization.features.includes('release-comparison');
    const isEntireReleasePeriod =
      hasReleaseComparison &&
      !location.query.pageStatsPeriod &&
      !location.query.pageStart;

    const {statsPeriod} = getReleaseParams({
      location,
      releaseBounds,
      defaultStatsPeriod,
      allowEmptyPeriod: hasReleaseComparison,
    });

    const selectedTimePeriod = statsPeriod ? DEFAULT_RELATIVE_PERIODS[statsPeriod] : null;
    const displayedPeriod = selectedTimePeriod
      ? selectedTimePeriod.toLowerCase()
      : t('given timeframe');

    return (
      <EmptyState>
        {issuesType === IssuesType.NEW
          ? isEntireReleasePeriod
            ? t('No new issues in this release.')
            : tct('No new issues for the [timePeriod].', {
                timePeriod: displayedPeriod,
              })
          : null}
        {issuesType === IssuesType.UNHANDLED
          ? isEntireReleasePeriod
            ? t('No unhandled issues in this release.')
            : tct('No unhandled issues for the [timePeriod].', {
                timePeriod: displayedPeriod,
              })
          : null}
        {issuesType === IssuesType.RESOLVED && t('No resolved issues in this release.')}
        {issuesType === IssuesType.ALL
          ? isEntireReleasePeriod
            ? t('No issues in this release')
            : tct('No issues for the [timePeriod].', {
                timePeriod: displayedPeriod,
              })
          : null}
      </EmptyState>
    );
  };

  render() {
    const {issuesType, count, pageLinks, onCursor} = this.state;
    const {organization, queryFilterDescription, withChart} = this.props;
    const {path, queryParams} = this.getIssuesEndpoint();
    const hasReleaseComparison = organization.features.includes('release-comparison');
    const issuesTypes = [
      {value: IssuesType.ALL, label: t('All Issues'), issueCount: count.all},
      {value: IssuesType.NEW, label: t('New Issues'), issueCount: count.new},
      {
        value: IssuesType.UNHANDLED,
        label: t('Unhandled Issues'),
        issueCount: count.unhandled,
      },
      {
        value: IssuesType.RESOLVED,
        label: t('Resolved Issues'),
        issueCount: count.resolved,
      },
    ];

    return (
      <Fragment>
        <ControlsWrapper>
          {hasReleaseComparison ? (
            <StyledButtonBar active={issuesType} merged>
              {issuesTypes.map(({value, label, issueCount}) => (
                <Button
                  key={value}
                  barId={value}
                  size="small"
                  onClick={() => this.handleIssuesTypeSelection(value)}
                >
                  {label}
                  <QueryCount
                    count={issueCount}
                    max={99}
                    hideParens
                    hideIfEmpty={false}
                  />
                </Button>
              ))}
            </StyledButtonBar>
          ) : (
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
          )}

          <OpenInButtonBar gap={1}>
            <Button to={this.getIssuesUrl()} size="small" data-test-id="issues-button">
              {t('Open in Issues')}
            </Button>

            {!hasReleaseComparison && (
              <GuideAnchor target="release_issues_open_in_discover">
                <DiscoverButton
                  to={this.getDiscoverUrl()}
                  size="small"
                  data-test-id="discover-button"
                >
                  {t('Open in Discover')}
                </DiscoverButton>
              </GuideAnchor>
            )}
            {!hasReleaseComparison && (
              <StyledPagination pageLinks={pageLinks} onCursor={onCursor} />
            )}
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
    ${ButtonGrid} {
      overflow: auto;
    }
  }
`;

const OpenInButtonBar = styled(ButtonBar)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    margin-top: ${space(1)};
  }
`;

const StyledButtonBar = styled(ButtonBar)`
  grid-template-columns: repeat(4, 1fr);
  ${ButtonLabel} {
    white-space: nowrap;
    grid-gap: ${space(0.5)};
    span:last-child {
      color: ${p => p.theme.buttonCount};
    }
  }
  .active {
    ${ButtonLabel} {
      span:last-child {
        color: ${p => p.theme.buttonCountActive};
      }
    }
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

export default withApi(withOrganization(Issues));
