import {Component, Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import pick from 'lodash/pick';
import * as qs from 'query-string';

import {Client} from 'app/api';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button, {ButtonLabel} from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import DiscoverButton from 'app/components/discoverButton';
import DropdownButton from 'app/components/dropdownButton';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import GroupList from 'app/components/issues/groupList';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import Pagination from 'app/components/pagination';
import QueryCount from 'app/components/queryCount';
import {DEFAULT_RELATIVE_PERIODS} from 'app/constants';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import {QueryResults, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import {IssueSortOptions} from 'app/views/issueList/utils';

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

type Props = {
  api: Client;
  organization: Organization;
  version: string;
  selection: GlobalSelection;
  location: Location;
  defaultStatsPeriod: string;
};

type State = {
  issuesType: IssuesType;
  pageLinks?: string;
  onCursor?: () => void;
  count: {
    firstRelease: number;
    release: number;
    resolved: number;
    unhandled: number;
  };
};

class Issues extends Component<Props, State> {
  state: State = this.getInitialState();

  getInitialState() {
    const {location} = this.props;
    const query = location.query ? location.query.query : null;
    const issuesTypeState = !query
      ? IssuesType.NEW
      : query.includes('first-release')
      ? IssuesType.NEW
      : query.includes('error.handled:0')
      ? IssuesType.UNHANDLED
      : query.includes('is:resolved')
      ? IssuesType.RESOLVED
      : IssuesType.ALL;
    return {
      issuesType: issuesTypeState,
      count: {
        firstRelease: 0,
        release: 0,
        resolved: 0,
        unhandled: 0,
      },
    };
  }

  componentDidMount() {
    this.fetchIssuesCount();
  }

  shouldComponentUpdate(nextProps: Props) {
    if (this.props.location.query) {
      if (this.props.location.query.query !== nextProps.location.query.query) {
        return true;
      }
    }

    return true;
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
        query.setTagValues('release', [version]);
        query.setTagValues('is', ['resolved']);
        break;
      case IssuesType.ALL:
        query.setTagValues('release', [version]);
        break;
      default:
        query.setTagValues('release', [version]);
    }

    return {
      pathname: `/organizations/${organization.slug}/issues/`,
      query: {
        ...queryParams,
        limit: undefined,
        cursor: undefined,
        query: stringifyQueryObject(query),
      },
    };
  }

  getIssuesEndpoint(): {path: string; queryParams: IssuesQueryParams} {
    const {version, organization, location, defaultStatsPeriod} = this.props;
    const {issuesType} = this.state;
    const queryParams = {
      ...getParams(pick(location.query, [...Object.values(URL_PARAM), 'cursor']), {
        defaultStatsPeriod,
      }),
      limit: 10,
      sort: IssueSortOptions.FREQ,
    };

    switch (issuesType) {
      case IssuesType.ALL:
        return {
          path: `/organizations/${organization.slug}/issues/`,
          queryParams: {
            ...queryParams,
            query: stringifyQueryObject(new QueryResults([`release:${version}`])),
          },
        };
      case IssuesType.RESOLVED:
        return {
          path: `/organizations/${organization.slug}/issues/`,
          queryParams: {
            ...queryParams,
            query: stringifyQueryObject(
              new QueryResults([`release:${version}`, 'is:resolved'])
            ),
          },
        };
      case IssuesType.UNHANDLED:
        return {
          path: `/organizations/${organization.slug}/issues/`,
          queryParams: {
            ...queryParams,
            query: stringifyQueryObject(
              new QueryResults([`release:${version}`, 'error.handled:0'])
            ),
          },
        };
      case IssuesType.NEW:
      default:
        return {
          path: `/organizations/${organization.slug}/issues/`,
          queryParams: {
            ...queryParams,
            query: stringifyQueryObject(new QueryResults([`first-release:${version}`])),
          },
        };
    }
  }

  async fetchIssuesCount() {
    const {api, version} = this.props;
    const endpoint = this.getIssueCountEndpoint();

    try {
      const response = await api.requestPromise(endpoint);
      this.setState({
        count: {
          release: response[`release:${version}`],
          firstRelease: response[`first-release:${version}`],
          resolved: response['is:resolved'],
          unhandled: response['error.handled:0'],
        },
      });
    } catch {
      // do nothing
    }
  }

  getIssueCountEndpoint() {
    const {organization, version} = this.props;
    const path = `/organizations/${organization.slug}/issues-count/`;
    const params = [
      `first-release:${version}`,
      `release:${version}`,
      'is:resolved',
      'error.handled:0',
    ];
    const queryParams = params.map(param => param);
    const queryParameters = {
      query: queryParams,
    };

    return `${path}?${qs.stringify(queryParameters)}`;
  }

  handleIssuesTypeSelection = (issuesType: IssuesType) => {
    const {location, version} = this.props;
    const issuesTypeQuery =
      issuesType === IssuesType.ALL
        ? `release:${version}`
        : issuesType === IssuesType.NEW
        ? `first-release:${version}`
        : issuesType === IssuesType.RESOLVED
        ? 'is:resolved'
        : issuesType === IssuesType.UNHANDLED
        ? 'error.handled:0'
        : `release:${version}`;

    const to = {
      ...location,
      query: {
        ...location.query,
        query: issuesTypeQuery,
      },
    };

    browserHistory.replace(to);
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
    const {issuesType, count, pageLinks, onCursor} = this.state;
    const {organization} = this.props;
    const {path, queryParams} = this.getIssuesEndpoint();
    const hasReleaseComparison = organization.features.includes('release-comparison');
    const issuesTypes = [
      {value: IssuesType.NEW, label: t('New Issues')},
      {value: IssuesType.RESOLVED, label: t('Resolved Issues')},
      {value: IssuesType.UNHANDLED, label: t('Unhandled Issues')},
      {value: IssuesType.ALL, label: t('All Issues')},
    ];

    return (
      <Fragment>
        <ControlsWrapper>
          {hasReleaseComparison ? (
            <StyledButtonBar active={issuesType} merged>
              <Button
                barId={IssuesType.NEW}
                size="small"
                onClick={() => this.handleIssuesTypeSelection(IssuesType.NEW)}
              >
                {t('New Issues')}
                <StyledQueryCount
                  count={count.firstRelease}
                  max={99}
                  hideParens
                  hideIfEmpty
                />
              </Button>
              <Button
                barId={IssuesType.RESOLVED}
                size="small"
                onClick={() => this.handleIssuesTypeSelection(IssuesType.RESOLVED)}
              >
                {t('Resolved Issues')}
                <StyledQueryCount
                  count={count.resolved}
                  max={99}
                  hideParens
                  hideIfEmpty
                />
              </Button>
              <Button
                barId={IssuesType.UNHANDLED}
                size="small"
                onClick={() => this.handleIssuesTypeSelection(IssuesType.UNHANDLED)}
              >
                {t('Unhandled Issues')}
                <StyledQueryCount
                  count={count.unhandled}
                  max={99}
                  hideParens
                  hideIfEmpty
                />
              </Button>
              <Button
                barId={IssuesType.ALL}
                size="small"
                onClick={() => this.handleIssuesTypeSelection(IssuesType.ALL)}
              >
                {t('All Issues')}
                <StyledQueryCount count={count.release} max={99} hideParens hideIfEmpty />
              </Button>
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

            <GuideAnchor target="release_issues_open_in_discover">
              {hasReleaseComparison ? null : (
                <DiscoverButton
                  to={this.getDiscoverUrl()}
                  size="small"
                  data-test-id="discover-button"
                >
                  {t('Open in Discover')}
                </DiscoverButton>
              )}
            </GuideAnchor>
            {hasReleaseComparison ? null : (
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
            withChart={false}
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

const StyledQueryCount = styled(QueryCount)``;

const StyledButtonBar = styled(ButtonBar)`
  grid-template-columns: repeat(4, 1fr);
  ${ButtonLabel} {
    grid-gap: ${space(0.5)};
    span:last-child {
      color: ${p => p.theme.gray400};
    }
  }
  .active {
    ${ButtonLabel} {
      span:last-child {
        color: ${p => p.theme.gray100};
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
