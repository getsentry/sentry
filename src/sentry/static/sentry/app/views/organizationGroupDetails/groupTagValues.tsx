import sortBy from 'lodash/sortBy';
import property from 'lodash/property';
import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';

import {isUrl, percent} from 'app/utils';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import UserBadge from 'app/components/idBadge/userBadge';
import Button from 'app/components/button';
import DeviceName from 'app/components/deviceName';
import ExternalLink from 'app/components/links/externalLink';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import {IconMail, IconOpen} from 'app/icons';
import Pagination from 'app/components/pagination';
import TimeSince from 'app/components/timeSince';
import DataExport, {ExportQueryType} from 'app/components/dataExport';
import space from 'app/styles/space';
import theme from 'app/utils/theme';
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
            <ValueWrapper>
              <GlobalSelectionLink
                to={{
                  pathname: issuesPath,
                  query: {query},
                }}
              >
                {tag.key === 'user' ? (
                  <UserBadge user={tagValue} avatarSize={20} hideEmail />
                ) : (
                  <DeviceName value={tagValue.name} />
                )}
              </GlobalSelectionLink>
              {tagValue.email && (
                <StyledExternalLink href={`mailto:${tagValue.email}`}>
                  <IconMail size="xs" color={theme.gray2} />
                </StyledExternalLink>
              )}
              {isUrl(tagValue.value) && (
                <StyledExternalLink href={tagValue.value}>
                  <IconOpen size="xs" color={theme.gray2} />
                </StyledExternalLink>
              )}
            </ValueWrapper>
          </td>
          <td>
            <TimeSince date={tagValue.lastSeen} />
          </td>
        </tr>
      );
    });

    return (
      <React.Fragment>
        <Header>
          {tag.key === 'user' ? t('Affected Users') : tag.name}
          <BrowserExportButton
            size="small"
            priority="default"
            href={`/${orgId}/${group.project.slug}/issues/${group.id}/tags/${tagKey}/export/`}
          >
            {t('Export Page to CSV')}
          </BrowserExportButton>
          <a />
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
        </Header>
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
      </React.Fragment>
    );
  }
}
const Header = styled('h3')`
  display: flex;
  align-items: flex-end;
`;

const BrowserExportButton = styled(Button)`
  margin: 0 ${space(1.5)};
`;

const TableHeader = styled('th')<{width: number}>`
  width: ${p => p.width}px;
`;
const ValueWrapper = styled('div')`
  display: flex;
  align-items: center;
`;
const StyledExternalLink = styled(ExternalLink)`
  margin-left: ${space(0.5)};
`;

export {GroupTagValues};
export default GroupTagValues;
