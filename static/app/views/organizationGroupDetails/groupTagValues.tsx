import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DataExport, {ExportQueryType} from 'sentry/components/dataExport';
import {DeviceName} from 'sentry/components/deviceName';
import DropdownLink from 'sentry/components/dropdownLink';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import UserBadge from 'sentry/components/idBadge/userBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels';
import TimeSince from 'sentry/components/timeSince';
import {IconArrow, IconEllipsis, IconMail, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Group, Project, SavedQueryVersions, Tag, TagValue} from 'sentry/types';
import {isUrl, percent} from 'sentry/utils';
import EventView from 'sentry/utils/discover/eventView';

type RouteParams = {
  groupId: string;
  orgId: string;
  tagKey?: string;
};

type Props = {
  baseUrl: string;
  group: Group;
  environments?: string[];
  project?: Project;
} & RouteComponentProps<RouteParams, {}>;

type State = {
  tag: Tag | null;
  tagValueList: TagValue[] | null;
  tagValueListPageLinks: string;
};

const DEFAULT_SORT = 'count';

class GroupTagValues extends AsyncComponent<
  Props & AsyncComponent['props'],
  State & AsyncComponent['state']
> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {environments: environment} = this.props;
    const {groupId, tagKey} = this.props.params;
    return [
      ['tag', `/issues/${groupId}/tags/${tagKey}/`],
      [
        'tagValueList',
        `/issues/${groupId}/tags/${tagKey}/values/`,
        {query: {environment, sort: this.getSort()}},
      ],
    ];
  }

  getSort(): string {
    return this.props.location.query.sort || DEFAULT_SORT;
  }

  renderLoading() {
    return this.renderBody();
  }

  renderResults() {
    const {
      baseUrl,
      project,
      environments: environment,
      params: {orgId, groupId, tagKey},
    } = this.props;
    const {tagValueList, tag} = this.state;
    const discoverFields = [
      'title',
      'release',
      'environment',
      'user.display',
      'timestamp',
    ];

    return tagValueList?.map((tagValue, tagValueIdx) => {
      const pct = tag?.totalValues
        ? `${percent(tagValue.count, tag?.totalValues).toFixed(2)}%`
        : '--';
      const key = tagValue.key ?? tagKey;
      const issuesQuery = tagValue.query || `${key}:"${tagValue.value}"`;
      const discoverView = EventView.fromSavedQuery({
        id: undefined,
        name: key ?? '',
        fields: [
          ...(key !== undefined ? [key] : []),
          ...discoverFields.filter(field => field !== key),
        ],
        orderby: '-timestamp',
        query: `issue.id:${groupId} ${issuesQuery}`,
        projects: [Number(project?.id)],
        environment,
        version: 2 as SavedQueryVersions,
        range: '90d',
      });
      const issuesPath = `/organizations/${orgId}/issues/`;

      return (
        <Fragment key={tagValueIdx}>
          <NameColumn>
            <NameWrapper data-test-id="group-tag-value">
              <GlobalSelectionLink
                to={{
                  pathname: `${baseUrl}events/`,
                  query: {query: issuesQuery},
                }}
              >
                {key === 'user' ? (
                  <UserBadge
                    user={{...tagValue, id: tagValue.identifier ?? ''}}
                    avatarSize={20}
                    hideEmail
                  />
                ) : (
                  <DeviceName value={tagValue.name} />
                )}
              </GlobalSelectionLink>
            </NameWrapper>

            {tagValue.email && (
              <StyledExternalLink
                href={`mailto:${tagValue.email}`}
                data-test-id="group-tag-mail"
              >
                <IconMail size="xs" color="gray300" />
              </StyledExternalLink>
            )}
            {isUrl(tagValue.value) && (
              <StyledExternalLink href={tagValue.value} data-test-id="group-tag-url">
                <IconOpen size="xs" color="gray300" />
              </StyledExternalLink>
            )}
          </NameColumn>
          <RightAlignColumn>{pct}</RightAlignColumn>
          <RightAlignColumn>{tagValue.count.toLocaleString()}</RightAlignColumn>
          <RightAlignColumn>
            <TimeSince date={tagValue.lastSeen} />
          </RightAlignColumn>
          <RightAlignColumn>
            <DropdownLink
              anchorRight
              alwaysRenderMenu={false}
              caret={false}
              title={
                <Button
                  tooltipProps={{
                    containerDisplayMode: 'flex',
                  }}
                  size="small"
                  type="button"
                  aria-label={t('Show more')}
                  icon={<IconEllipsis size="xs" />}
                />
              }
            >
              <Feature features={['organizations:discover-basic']}>
                <li>
                  <Link to={discoverView.getResultsViewUrlTarget(orgId)}>
                    {t('Open in Discover')}
                  </Link>
                </li>
              </Feature>
              <li>
                <GlobalSelectionLink
                  to={{pathname: issuesPath, query: {query: issuesQuery}}}
                >
                  {t('Search All Issues with Tag Value')}
                </GlobalSelectionLink>
              </li>
            </DropdownLink>
          </RightAlignColumn>
        </Fragment>
      );
    });
  }

  renderBody() {
    const {
      group,
      params: {orgId, tagKey},
      location: {query},
      environments,
    } = this.props;
    const {tagValueList, tag, tagValueListPageLinks, loading} = this.state;
    const {cursor: _cursor, page: _page, ...currentQuery} = query;

    const title = tagKey === 'user' ? t('Affected Users') : tagKey;

    const sort = this.getSort();
    const sortArrow = <IconArrow color="gray300" size="xs" direction="down" />;
    const lastSeenColumnHeader = (
      <StyledSortLink
        to={{
          pathname: location.pathname,
          query: {
            ...currentQuery,
            sort: 'date',
          },
        }}
      >
        {t('Last Seen')} {sort === 'date' && sortArrow}
      </StyledSortLink>
    );
    const countColumnHeader = (
      <StyledSortLink
        to={{
          pathname: location.pathname,
          query: {
            ...currentQuery,
            sort: 'count',
          },
        }}
      >
        {t('Count')} {sort === 'count' && sortArrow}
      </StyledSortLink>
    );

    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <TitleWrapper>
            <Title>{t('Tag Details')}</Title>
            <ButtonBar gap={1}>
              <Button
                size="small"
                priority="default"
                href={`/${orgId}/${group.project.slug}/issues/${group.id}/tags/${tagKey}/export/`}
              >
                {t('Export Page to CSV')}
              </Button>
              <DataExport
                payload={{
                  queryType: ExportQueryType.IssuesByTag,
                  queryInfo: {
                    project: group.project.id,
                    group: group.id,
                    key: tagKey,
                  },
                }}
              />
            </ButtonBar>
          </TitleWrapper>
          <StyledPanelTable
            isLoading={loading}
            isEmpty={tagValueList?.length === 0}
            headers={[
              title,
              <PercentColumnHeader key="percent">{t('Percent')}</PercentColumnHeader>,
              countColumnHeader,
              lastSeenColumnHeader,
              '',
            ]}
            emptyMessage={t('Sorry, the tags for this issue could not be found.')}
            emptyAction={
              !!environments?.length
                ? t('No tags were found for the currently selected environments')
                : null
            }
          >
            {tagValueList && tag && this.renderResults()}
          </StyledPanelTable>
          <StyledPagination pageLinks={tagValueListPageLinks} />
        </Layout.Main>
      </Layout.Body>
    );
  }
}

export default GroupTagValues;

const TitleWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${space(2)};
`;

const Title = styled('h3')`
  margin: 0;
`;

const StyledPanelTable = styled(PanelTable)`
  white-space: nowrap;
  font-size: ${p => p.theme.fontSizeMedium};

  overflow: auto;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    overflow: initial;
  }

  & > * {
    padding: ${space(1)} ${space(2)};
  }
`;

const PercentColumnHeader = styled('div')`
  text-align: right;
`;

const StyledSortLink = styled(Link)`
  text-align: right;
  color: inherit;

  :hover {
    color: inherit;
  }
`;

const StyledExternalLink = styled(ExternalLink)`
  margin-left: ${space(0.5)};
`;

const Column = styled('div')`
  display: flex;
  align-items: center;
`;

const NameColumn = styled(Column)`
  ${overflowEllipsis};
  display: flex;
  min-width: 320px;
`;

const NameWrapper = styled('span')`
  ${overflowEllipsis};
  width: auto;
`;

const RightAlignColumn = styled(Column)`
  justify-content: flex-end;
`;

const StyledPagination = styled(Pagination)`
  margin: 0;
`;
