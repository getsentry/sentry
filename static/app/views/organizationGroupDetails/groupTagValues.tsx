import {Fragment} from 'react';
import {Link, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import DataExport, {ExportQueryType} from 'app/components/dataExport';
import DeviceName from 'app/components/deviceName';
import DiscoverButton from 'app/components/discoverButton';
import DropdownLink from 'app/components/dropdownLink';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import UserBadge from 'app/components/idBadge/userBadge';
import ExternalLink from 'app/components/links/externalLink';
import Pagination from 'app/components/pagination';
import {PanelTable} from 'app/components/panels';
import TimeSince from 'app/components/timeSince';
import {IconArrow, IconEllipsis, IconMail, IconOpen} from 'app/icons';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Environment, Group, Project, SavedQueryVersions, Tag, TagValue} from 'app/types';
import {isUrl, percent} from 'app/utils';
import EventView from 'app/utils/discover/eventView';

type RouteParams = {
  groupId: string;
  orgId: string;
  tagKey: string;
};

type Props = {
  project?: Project;
  group: Group;
  environments?: Environment[];
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
      project,
      params: {orgId, groupId, tagKey},
    } = this.props;
    const {tagValueList, tag} = this.state;

    return tagValueList?.map((tagValue, tagValueIdx) => {
      const pct = tag?.totalValues
        ? `${percent(tagValue.count, tag?.totalValues).toFixed(2)}%`
        : '--';
      const key = tagValue.key ?? tagKey;
      const issuesQuery = tagValue.query || `${key}:"${tagValue.value}"`;
      const discoverQuery = {
        id: undefined,
        name: key,
        fields: [key, 'title', 'release', 'environment', 'user.display', 'timestamp'],
        orderby: '-timestamp',
        query: `issue.id:${groupId} ${issuesQuery}`,
        projects: [Number(project?.id)],
        version: 2 as SavedQueryVersions,
        range: '90d',
      };

      const discoverView = EventView.fromSavedQuery(discoverQuery);
      const issuesPath = `/organizations/${orgId}/issues/`;

      return (
        <Fragment key={tagValueIdx}>
          <NameColumn>
            <NameWrapper data-test-id="group-tag-value">
              {key === 'user' ? (
                <UserBadge
                  user={{...tagValue, id: tagValue.identifier ?? ''}}
                  avatarSize={20}
                  hideEmail
                />
              ) : (
                <DeviceName value={tagValue.name} />
              )}
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
      project,
      params: {orgId, tagKey, groupId},
      location: {query},
      environments,
    } = this.props;
    const {tagValueList, tag, tagValueListPageLinks, loading} = this.state;
    const {cursor: _cursor, page: _page, ...currentQuery} = query;

    const title = tagKey === 'user' ? t('Affected Users') : tagKey;
    const discoverQuery = {
      id: undefined,
      name: tagKey,
      fields: [tagKey, 'title', 'release', 'environment', 'user.display', 'timestamp'],
      orderby: '-timestamp',
      query: `issue.id:${groupId} has:${tagKey}`,
      projects: [Number(project?.id)],
      version: 2 as SavedQueryVersions,
      range: '90d',
    };

    const discoverView = EventView.fromSavedQuery(discoverQuery);

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
      <Fragment>
        <TitleWrapper>
          <Title>{t('Tag Details')}</Title>
          <ButtonBar gap={1}>
            <DiscoverButton size="small" to={discoverView.getResultsViewUrlTarget(orgId)}>
              {t('Open in Discover')}
            </DiscoverButton>
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
      </Fragment>
    );
  }
}

export default GroupTagValues;

const TitleWrapper = styled('div')`
  display: flex;
  flex-direction: row;
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
