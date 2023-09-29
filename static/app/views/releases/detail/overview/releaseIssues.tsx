import {Component, Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import * as qs from 'query-string';

import {Client} from 'sentry/api';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import GroupList from 'sentry/components/issues/groupList';
import Pagination from 'sentry/components/pagination';
import QueryCount from 'sentry/components/queryCount';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

import {getReleaseParams, ReleaseBounds} from '../../utils';
import EmptyState from '../commitsAndFiles/emptyState';

enum IssuesType {
  NEW = 'new',
  UNHANDLED = 'unhandled',
  REGRESSED = 'regressed',
  RESOLVED = 'resolved',
  ALL = 'all',
}

const issuesQuery: Record<IssuesType, string> = {
  [IssuesType.NEW]: 'first-release',
  [IssuesType.UNHANDLED]: 'error.handled:0',
  [IssuesType.REGRESSED]: 'regressed_in_release',
  [IssuesType.RESOLVED]: 'is:resolved',
  [IssuesType.ALL]: 'release',
};

type IssuesQueryParams = {
  limit: number;
  query: string;
  sort: string;
};

const defaultProps = {
  withChart: false,
};

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
  releaseBounds: ReleaseBounds;
  version: string;
  queryFilterDescription?: string;
} & Partial<typeof defaultProps>;

type State = {
  count: {
    all: number | null;
    new: number | null;
    regressed: number | null;
    resolved: number | null;
    unhandled: number | null;
  };
  onCursor?: () => void;
  pageLinks?: string;
};

class ReleaseIssues extends Component<Props, State> {
  static defaultProps = defaultProps;
  state: State = this.getInitialState();

  getInitialState() {
    return {
      count: {
        new: null,
        all: null,
        resolved: null,
        unhandled: null,
        regressed: null,
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
        }),
        getReleaseParams({
          location: prevProps.location,
          releaseBounds: prevProps.releaseBounds,
        })
      )
    ) {
      this.fetchIssuesCount();
    }
  }

  getActiveIssuesType(): IssuesType {
    const query = (this.props.location.query?.issuesType as string) ?? '';
    return Object.values<string>(IssuesType).includes(query)
      ? (query as IssuesType)
      : IssuesType.NEW;
  }

  getIssuesUrl() {
    const {version, organization} = this.props;
    const issuesType = this.getActiveIssuesType();
    const {queryParams} = this.getIssuesEndpoint();
    const query = new MutableSearch([]);

    switch (issuesType) {
      case IssuesType.NEW:
        query.setFilterValues('firstRelease', [version]);
        break;
      case IssuesType.UNHANDLED:
        query.setFilterValues('release', [version]);
        query.setFilterValues('error.handled', ['0']);
        break;
      case IssuesType.REGRESSED:
        query.setFilterValues('regressed_in_release', [version]);
        break;
      case IssuesType.RESOLVED:
      case IssuesType.ALL:
      default:
        query.setFilterValues('release', [version]);
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
    const {version, organization, location, releaseBounds} = this.props;
    const issuesType = this.getActiveIssuesType();

    const queryParams = {
      ...getReleaseParams({
        location,
        releaseBounds,
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
            query: new MutableSearch([
              `${issuesQuery.all}:${version}`,
              'is:unresolved',
            ]).formatString(),
          },
        };
      case IssuesType.RESOLVED:
        return {
          path: `/organizations/${organization.slug}/releases/${encodeURIComponent(
            version
          )}/resolved/`,
          queryParams: {...queryParams, query: ''},
        };
      case IssuesType.UNHANDLED:
        return {
          path: `/organizations/${organization.slug}/issues/`,
          queryParams: {
            ...queryParams,
            query: new MutableSearch([
              `${issuesQuery.all}:${version}`,
              issuesQuery.unhandled,
              'is:unresolved',
            ]).formatString(),
          },
        };
      case IssuesType.REGRESSED:
        return {
          path: `/organizations/${organization.slug}/issues/`,
          queryParams: {
            ...queryParams,
            query: new MutableSearch([
              `${issuesQuery.regressed}:${version}`,
            ]).formatString(),
          },
        };
      case IssuesType.NEW:
      default:
        return {
          path: `/organizations/${organization.slug}/issues/`,
          queryParams: {
            ...queryParams,
            query: new MutableSearch([
              `${issuesQuery.new}:${version}`,
              'is:unresolved',
            ]).formatString(),
          },
        };
    }
  }

  async fetchIssuesCount() {
    const {api, organization, version} = this.props;
    const issueCountEndpoint = this.getIssueCountEndpoint();
    const resolvedEndpoint = `/organizations/${
      organization.slug
    }/releases/${encodeURIComponent(version)}/resolved/`;

    try {
      await Promise.all([
        api.requestPromise(issueCountEndpoint),
        api.requestPromise(resolvedEndpoint),
      ]).then(([issueResponse, resolvedResponse]) => {
        this.setState({
          count: {
            all: issueResponse[`${issuesQuery.all}:"${version}" is:unresolved`] || 0,
            new: issueResponse[`${issuesQuery.new}:"${version}" is:unresolved`] || 0,
            resolved: resolvedResponse.length,
            unhandled:
              issueResponse[
                `${issuesQuery.unhandled} ${issuesQuery.all}:"${version}" is:unresolved`
              ] || 0,
            regressed: issueResponse[`${issuesQuery.regressed}:"${version}"`] || 0,
          },
        });
      });
    } catch {
      // do nothing
    }
  }

  getIssueCountEndpoint() {
    const {organization, version, location, releaseBounds} = this.props;
    const issuesCountPath = `/organizations/${organization.slug}/issues-count/`;

    const params = [
      `${issuesQuery.new}:"${version}" is:unresolved`,
      `${issuesQuery.all}:"${version}" is:unresolved`,
      `${issuesQuery.unhandled} ${issuesQuery.all}:"${version}" is:unresolved`,
      `${issuesQuery.regressed}:"${version}"`,
    ];
    const queryParams = params.map(param => param);
    const queryParameters = {
      ...getReleaseParams({
        location,
        releaseBounds,
      }),
      query: queryParams,
    };

    return `${issuesCountPath}?${qs.stringify(queryParameters)}`;
  }

  handleIssuesTypeSelection = (issuesType: IssuesType) => {
    const {location} = this.props;

    browserHistory.replace({
      ...location,
      query: {
        ...location.query,
        issuesType,
      },
    });
  };

  handleFetchSuccess = (groupListState, onCursor) => {
    this.setState({pageLinks: groupListState.pageLinks, onCursor});
  };

  renderEmptyMessage = () => {
    const {location, releaseBounds} = this.props;
    const issuesType = this.getActiveIssuesType();
    const isEntireReleasePeriod =
      !location.query.pageStatsPeriod && !location.query.pageStart;

    const {statsPeriod} = getReleaseParams({
      location,
      releaseBounds,
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
        {issuesType === IssuesType.REGRESSED
          ? isEntireReleasePeriod
            ? t('No regressed issues in this release.')
            : tct('No regressed issues for the [timePeriod].', {
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
    const {count, pageLinks, onCursor} = this.state;
    const issuesType = this.getActiveIssuesType();
    const {organization, queryFilterDescription, withChart, version} = this.props;
    const {path, queryParams} = this.getIssuesEndpoint();
    const issuesTypes = [
      {value: IssuesType.ALL, label: t('All Issues'), issueCount: count.all},
      {value: IssuesType.NEW, label: t('New Issues'), issueCount: count.new},
      {
        value: IssuesType.UNHANDLED,
        label: t('Unhandled'),
        issueCount: count.unhandled,
      },
      {
        value: IssuesType.REGRESSED,
        label: t('Regressed'),
        issueCount: count.regressed,
      },
      {
        value: IssuesType.RESOLVED,
        label: t('Resolved'),
        issueCount: count.resolved,
      },
    ];

    return (
      <Fragment>
        <ControlsWrapper>
          <GuideAnchor target="release_states">
            <SegmentedControl
              aria-label={t('Issue type')}
              size="xs"
              value={issuesType}
              onChange={key => this.handleIssuesTypeSelection(key)}
            >
              {issuesTypes.map(({value, label, issueCount}) => (
                <SegmentedControl.Item key={value} textValue={label}>
                  {label}&nbsp;
                  <QueryCount
                    count={issueCount}
                    max={99}
                    hideParens
                    hideIfEmpty={false}
                  />
                </SegmentedControl.Item>
              ))}
            </SegmentedControl>
          </GuideAnchor>

          <OpenInButtonBar gap={1}>
            <Button to={this.getIssuesUrl()} size="xs">
              {t('Open in Issues')}
            </Button>

            <StyledPagination pageLinks={pageLinks} onCursor={onCursor} size="xs" />
          </OpenInButtonBar>
        </ControlsWrapper>
        <div data-test-id="release-wrapper">
          <GroupList
            orgSlug={organization.slug}
            endpointPath={path}
            queryParams={queryParams}
            query={`release:${version}`}
            canSelectGroups={false}
            queryFilterDescription={queryFilterDescription}
            withChart={withChart}
            narrowGroups
            renderEmptyMessage={this.renderEmptyMessage}
            withPagination={false}
            onFetchSuccess={this.handleFetchSuccess}
            source="release"
          />
        </div>
      </Fragment>
    );
  }
}

const ControlsWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: block;
  }
`;

const OpenInButtonBar = styled(ButtonBar)`
  margin: ${space(1)} 0;
`;

const StyledPagination = styled(Pagination)`
  margin: 0;
`;

export default withApi(withOrganization(ReleaseIssues));
