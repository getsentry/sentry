import sortBy from 'lodash/sortBy';
import property from 'lodash/property';
import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {isUrl, percent} from 'app/utils';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import UserAvatar from 'app/components/avatar/userAvatar';
import DeviceName from 'app/components/deviceName';
import ExternalLink from 'app/components/links/externalLink';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import Pagination from 'app/components/pagination';
import TimeSince from 'app/components/timeSince';
import {Group, Tag, TagValue} from 'app/types';

type RouteParams = {
  groupId: number;
  orgId: string;
  tagKey: string;
};

type Props = {
  group: Group;
  location: {
    query: object;
  };
} & RouteComponentProps<RouteParams, {}>;

type State = {
  tagKey: Tag;
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
      ['tagKey', `/issues/${groupId}/tags/${tagKey}/`],
      ['tagValueList', `/issues/${groupId}/tags/${tagKey}/values/`],
    ];
  }

  getUserDisplayName(item): string {
    return item.email || item.username || item.identifier || item.ipAddress || item.value;
  }

  renderBody() {
    const {
      group,
      params: {orgId},
    } = this.props;
    const {tagKey, tagValueList, tagValueListPageLinks} = this.state;
    const sortedTagValueList: TagValue[] = sortBy(
      tagValueList,
      property('count')
    ).reverse();

    const issuesPath = `/organizations/${orgId}/issues/`;

    const children = sortedTagValueList.map((tagValue: TagValue, tagValueIdx: number) => {
      const pct = tagKey.totalValues
        ? `${percent(tagValue.count, tagKey.totalValues).toFixed(2)}%`
        : '--';
      const query = tagValue.query || `${tagKey.key}:"${tagValue.value}"`;
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
              {tagKey.key === 'user' ? (
                <React.Fragment>
                  <UserAvatar user={tagValue} size={20} className="avatar" />
                  <span style={{marginLeft: 10}}>
                    {this.getUserDisplayName(tagValue)}
                  </span>
                </React.Fragment>
              ) : (
                <DeviceName>{tagValue.name}</DeviceName>
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
      <div>
        <h3>
          {tagKey.key === 'user' ? t('Affected Users') : tagKey.name}
          <a
            href={`/${orgId}/${group.project.slug}/issues/${group.id}/tags/${this.props.params.tagKey}/export/`}
            className="btn btn-default btn-sm"
            style={{marginLeft: 10}}
          >
            {t('Export to CSV')}
          </a>
        </h3>
        <table className="table table-striped">
          <thead>
            <tr>
              <th style={{width: 30}}>%</th>
              <th />
              <th style={{width: 200}}>{t('Last Seen')}</th>
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
      </div>
    );
  }
}

export {GroupTagValues};
export default GroupTagValues;
