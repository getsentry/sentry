import {Fragment} from 'react';
import {Link, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import DataExport, {ExportQueryType} from 'app/components/dataExport';
import DeviceName from 'app/components/deviceName';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import UserBadge from 'app/components/idBadge/userBadge';
import ExternalLink from 'app/components/links/externalLink';
import Pagination from 'app/components/pagination';
import {PanelTable} from 'app/components/panels';
import TimeSince from 'app/components/timeSince';
import {IconArrow, IconMail, IconOpen} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Environment, Group, Tag, TagValue} from 'app/types';
import {isUrl, percent} from 'app/utils';

type RouteParams = {
  groupId: string;
  orgId: string;
  tagKey: string;
};

type Props = {
  group: Group;
  environments: Environment[];
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

  renderTagName(tagValue: TagValue) {
    const {tag} = this.state;
    const {
      params: {orgId},
    } = this.props;
    const issuesPath = `/organizations/${orgId}/issues/`;
    const query = tagValue.query || `${tag?.key}:"${tagValue.value}"`;

    return (
      <Fragment>
        <GlobalSelectionLink
          to={{
            pathname: issuesPath,
            query: {query},
          }}
        >
          {tag?.key === 'user' ? (
            <UserBadge
              user={{...tagValue, id: tagValue.identifier ?? ''}}
              avatarSize={20}
              hideEmail
            />
          ) : (
            <DeviceName value={tagValue.name} />
          )}
        </GlobalSelectionLink>
        {tagValue.email && (
          <StyledExternalLink href={`mailto:${tagValue.email}`}>
            <IconMail size="xs" color="gray300" />
          </StyledExternalLink>
        )}
        {isUrl(tagValue.value) && (
          <StyledExternalLink href={tagValue.value}>
            <IconOpen size="xs" color="gray300" />
          </StyledExternalLink>
        )}
      </Fragment>
    );
  }

  renderResults() {
    const {tagValueList, tag} = this.state;
    return tagValueList?.map((tagValue, tagValueIdx) => {
      const pct = tag?.totalValues
        ? `${percent(tagValue.count, tag?.totalValues).toFixed(2)}%`
        : '--';
      return (
        <Fragment key={tagValueIdx}>
          <Column>{this.renderTagName(tagValue)}</Column>
          <RightAlignColumn>{pct}</RightAlignColumn>
          <RightAlignColumn>{tagValue.count.toLocaleString()}</RightAlignColumn>
          <RightAlignColumn>
            <TimeSince date={tagValue.lastSeen} />
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
    const {tagValueList, tagValueListPageLinks, loading} = this.state;
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
      <Fragment>
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
          ]}
          emptyMessage={t('Sorry, the tags for this issue could not be found.')}
          emptyAction={
            environments.length > 0
              ? t('No tags were found for the currently selected environments')
              : null
          }
        >
          {this.renderResults()}
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

const RightAlignColumn = styled(Column)`
  justify-content: flex-end;
`;

const StyledPagination = styled(Pagination)`
  margin: 0;
`;
