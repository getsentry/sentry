import sortBy from 'lodash/sortBy';
import property from 'lodash/property';
import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import styled from '@emotion/styled';
import {isUrl, percent} from 'app/utils';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import UserAvatar from 'app/components/avatar/userAvatar';
import DeviceName from 'app/components/deviceName';
import ExternalLink from 'app/components/links/externalLink';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import Pagination from 'app/components/pagination';
import TimeSince from 'app/components/timeSince';
import DataExport from 'app/components/dataExport';
import space from 'app/styles/space';
import {Group, Tag, TagValue} from 'app/types';

type RouteParams = {
  groupId: string;
  orgId: string;
  tagKey: string;
};

type Props = {
  group: Group;
} & RouteComponentProps<RouteParams, {}>;

type State = {
  tag: Tag;
  tagValueList: TagValue[];
  tagValueListPageLinks: string;
};

class GroupTagValues extends AsyncComponent<
  Props & AsyncComponent['props'],
  State & AsyncComponent['state']
> {
  getEndpoints(): [string, string][] {
    const {groupId, tagKey} = this.props.params;
    return [
      ['tag', `/issues/${groupId}/tags/${tagKey}/`],
      ['tagValueList', `/issues/${groupId}/tags/${tagKey}/values/`],
    ];
  }

  getUserDisplayName(item: TagValue): string {
    return item.email || item.username || item.identifier || item.ipAddress || item.value;
  }

  renderBody() {
    const {
      group,
      params: {orgId, tagKey},
    } = this.props;
    const {tag, tagValueList, tagValueListPageLinks} = this.state;
    const sortedTagValueList: TagValue[] = sortBy(
      tagValueList,
      property('count')
    ).reverse();

    const issuesPath = `/organizations/${orgId}/issues/`;

    const children = sortedTagValueList.map((tagValue, tagValueIdx) => {
      const pct = tag.totalValues
        ? `${percent(tagValue.count, tag.totalValues).toFixed(2)}%`
        : '--';
      const query = tagValue.query || `${tag.key}:"${tagValue.value}"`;
      return (
        <tr key={tagValueIdx}>
          <td className="bar-cell">
            <span className="label">{pct}</span>
          </td>
          <td>
            <GlobalSelectionLink
              to={{
                pathname: issuesPath,
                query: {query},
              }}
            >
              {tag.key === 'user' ? (
                <React.Fragment>
                  <UserAvatar user={tagValue} size={20} className="avatar" />
                  <span className="m-left">{this.getUserDisplayName(tagValue)}</span>
                </React.Fragment>
              ) : (
                <DeviceName value={tagValue.name} />
              )}
            </GlobalSelectionLink>
            {tagValue.email && (
              <ExternalLink href={`mailto:${tagValue.email}`} className="external-icon">
                <em className="icon-envelope" />
              </ExternalLink>
            )}
            {isUrl(tagValue.value) && (
              <a href={tagValue.value} className="external-icon">
                <em className="icon-open" />
              </a>
            )}
          </td>
          <td>
            <TimeSince date={tagValue.lastSeen} />
          </td>
        </tr>
      );
    });

    return (
      <TableWrapper>
        <h3>
          {tag.key === 'user' ? t('Affected Users') : tag.name}
          <a
            href={`/${orgId}/${group.project.slug}/issues/${group.id}/tags/${tagKey}/export/`}
            className="btn btn-default btn-sm m-left m-right"
          >
            {t('Export Page to CSV')}
          </a>
          <DataExport
            payload={{
              queryType: 2,
              queryInfo: {
                project_id: group.project.id,
                group_id: group.id,
                key: tagKey,
              },
            }}
          />
        </h3>
        <table className="table table-striped">
          <thead>
            <tr>
              <TableHeader width={20}>%</TableHeader>
              <th />
              <TableHeader width={300}>{t('Last Seen')}</TableHeader>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
        <Pagination pageLinks={tagValueListPageLinks} />
        <p>
          <small>
            {t('Note: Percentage of issue is based on events seen in the last 7 days.')}
          </small>
        </p>
      </TableWrapper>
    );
  }
}

const TableWrapper = styled('div')`
  .m-left {
    margin-left: ${space(1.5)};
  }
  .m-right {
    margin-right: ${space(1.5)};
  }
`;

const TableHeader = styled('th')<{width: number}>`
  width: ${p => p.width}px;
`;

export {GroupTagValues};
export default GroupTagValues;
