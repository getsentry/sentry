import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import AssigneeSelector from 'sentry/components/assigneeSelector';
import Count from 'sentry/components/count';
import Link from 'sentry/components/links/link';
import {getRelativeSummary} from 'sentry/components/organizations/timeRangeSelector/utils';
import Tooltip from 'sentry/components/tooltip';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import EventView, {EventData} from 'sentry/utils/discover/eventView';

import {Container, FieldShortId, OverflowLink} from '../discover/styles';

/**
 * Types, functions and definitions for rendering fields in discover results.
 */
type RenderFunctionBaggage = {
  location: Location;
  organization: Organization;
  eventView?: EventView;
};

type FieldFormatterRenderFunctionPartial = (
  data: EventData,
  baggage: RenderFunctionBaggage
) => React.ReactNode;

type SpecialFieldRenderFunc = (
  data: EventData,
  baggage: RenderFunctionBaggage
) => React.ReactNode;

type SpecialField = {
  renderFunc: SpecialFieldRenderFunc;
  sortField: string | null;
};

type SpecialFields = {
  assignee: SpecialField;
  count: SpecialField;
  events: SpecialField;
  issue: SpecialField;
  lifetimeCount: SpecialField;
  lifetimeEvents: SpecialField;
  lifetimeUserCount: SpecialField;
  lifetimeUsers: SpecialField;
  links: SpecialField;
  userCount: SpecialField;
  users: SpecialField;
};

/**
 * "Special fields" either do not map 1:1 to an single column in the event database,
 * or they require custom UI formatting that can't be handled by the datatype formatters.
 */
const SPECIAL_FIELDS: SpecialFields = {
  issue: {
    sortField: null,
    renderFunc: (data, {organization}) => {
      const issueID = data['issue.id'];

      if (!issueID) {
        return (
          <Container>
            <FieldShortId shortId={`${data.issue}`} />
          </Container>
        );
      }

      const target = {
        pathname: `/organizations/${organization.slug}/issues/${issueID}/`,
      };

      return (
        <Container>
          <OverflowLink to={target} aria-label={issueID}>
            <FieldShortId shortId={`${data.issue}`} />
          </OverflowLink>
        </Container>
      );
    },
  },
  assignee: {
    sortField: 'assignee.name',
    renderFunc: data => {
      const memberList = MemberListStore.getAll();
      return (
        <ActorContainer>
          <AssigneeSelector id={data.id} memberList={memberList} noDropdown />
        </ActorContainer>
      );
    },
  },
  lifetimeEvents: {
    sortField: null,
    renderFunc: (data, {organization}) =>
      issuesCountRenderer(data, organization, 'lifetimeEvents'),
  },
  lifetimeUsers: {
    sortField: null,
    renderFunc: (data, {organization}) =>
      issuesCountRenderer(data, organization, 'lifetimeUsers'),
  },
  events: {
    sortField: null,
    renderFunc: (data, {organization}) =>
      issuesCountRenderer(data, organization, 'events'),
  },
  users: {
    sortField: null,
    renderFunc: (data, {organization}) =>
      issuesCountRenderer(data, organization, 'users'),
  },
  lifetimeCount: {
    sortField: null,
    renderFunc: (data, {organization}) =>
      issuesCountRenderer(data, organization, 'lifetimeEvents'),
  },
  lifetimeUserCount: {
    sortField: null,
    renderFunc: (data, {organization}) =>
      issuesCountRenderer(data, organization, 'lifetimeUsers'),
  },
  count: {
    sortField: null,
    renderFunc: (data, {organization}) =>
      issuesCountRenderer(data, organization, 'events'),
  },
  userCount: {
    sortField: null,
    renderFunc: (data, {organization}) =>
      issuesCountRenderer(data, organization, 'users'),
  },
  links: {
    sortField: null,
    renderFunc: ({links}) => <LinksContainer dangerouslySetInnerHTML={{__html: links}} />,
  },
};

const issuesCountRenderer = (
  data: EventData,
  organization: Organization,
  field: 'events' | 'users' | 'lifetimeEvents' | 'lifetimeUsers'
) => {
  const {start, end, period} = data;
  const isUserField = !!/user/i.exec(field.toLowerCase());
  const primaryCount = data[field];
  const count = data[isUserField ? 'users' : 'events'];
  const lifetimeCount = data[isUserField ? 'lifetimeUsers' : 'lifetimeEvents'];
  const filteredCount = data[isUserField ? 'filteredUsers' : 'filteredEvents'];
  const discoverLink = getDiscoverUrl(data, organization);
  const filteredDiscoverLink = getDiscoverUrl(data, organization, true);
  const selectionDateString =
    !!start && !!end
      ? 'time range'
      : getRelativeSummary(period || DEFAULT_STATS_PERIOD).toLowerCase();
  return (
    <Container>
      <Tooltip
        isHoverable
        skipWrapper
        popperStyle={{padding: 0}}
        title={
          <div>
            {filteredCount ? (
              <React.Fragment>
                <StyledLink to={filteredDiscoverLink}>
                  {t('Matching search filters')}
                  <WrappedCount value={filteredCount} />
                </StyledLink>
                <Divider />
              </React.Fragment>
            ) : null}
            <StyledLink to={discoverLink}>
              {t(`Total in ${selectionDateString}`)}
              <WrappedCount value={count} />
            </StyledLink>
            <Divider />
            <StyledContent>
              {t('Since issue began')}
              <WrappedCount value={lifetimeCount} />
            </StyledContent>
          </div>
        }
      >
        <span>
          {['events', 'users'].includes(field) && filteredCount ? (
            <React.Fragment>
              <Count value={filteredCount} />
              <SecondaryCount value={primaryCount} />
            </React.Fragment>
          ) : (
            <Count value={primaryCount} />
          )}
        </span>
      </Tooltip>
    </Container>
  );
};

const getDiscoverUrl = (
  data: EventData,
  organization: Organization,
  filtered?: boolean
) => {
  const commonQuery = {projects: [Number(data.projectId)]};
  const discoverView = EventView.fromSavedQuery({
    ...commonQuery,
    id: undefined,
    start: data.start,
    end: data.end,
    range: data.period,
    name: data.title,
    fields: ['title', 'release', 'environment', 'user', 'timestamp'],
    orderby: '-timestamp',
    query: `issue.id:${data.id}${filtered ? data.discoverSearchQuery : ''}`,
    version: 2,
  });
  return discoverView.getResultsViewUrlTarget(organization.slug);
};

const contentStyle = css`
  width: 100%;
  justify-content: space-between;
  display: flex;
  padding: 6px 10px;
`;

const StyledContent = styled('div')`
  ${contentStyle};
`;

const StyledLink = styled(Link)`
  ${contentStyle};
  color: ${p => p.theme.gray400};
  &:hover {
    color: ${p => p.theme.gray400};
    background: ${p => p.theme.hover};
  }
`;

const SecondaryCount = styled(Count)`
  :before {
    content: '/';
    padding-left: ${space(0.25)};
    padding-right: 2px;
  }
`;

const WrappedCount = styled(({value, ...p}) => (
  <div {...p}>
    <Count value={value} />
  </div>
))`
  text-align: right;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
  padding-left: ${space(2)};
  color: ${p => p.theme.subText};
`;

const Divider = styled('div')`
  height: 1px;
  overflow: hidden;
  background-color: ${p => p.theme.innerBorder};
`;

const ActorContainer = styled('div')`
  display: flex;
  justify-content: left;
  margin-left: 18px;
  :hover {
    cursor: default;
  }
`;

const LinksContainer = styled('span')`
  white-space: nowrap;
`;

/**
 * Get the field renderer for the named field and metadata
 *
 * @param {String} field name
 * @param {object} metadata mapping.
 * @returns {Function}
 */
export function getIssueFieldRenderer(
  field: string
): FieldFormatterRenderFunctionPartial | null {
  if (SPECIAL_FIELDS.hasOwnProperty(field)) {
    return SPECIAL_FIELDS[field].renderFunc;
  }

  // Return null if there is no field renderer for this field
  // Should check the discover field renderer for this field
  return null;
}
