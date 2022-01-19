import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';
import partial from 'lodash/partial';

import AssigneeSelector from 'sentry/components/assigneeSelector';
import Count from 'sentry/components/count';
import DateTime from 'sentry/components/dateTime';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import EventView, {EventData, MetaType} from 'sentry/utils/discover/eventView';

import {FIELD_FORMATTERS} from '../discover/fieldRenderers';
import {Container, FieldShortId, OverflowLink} from '../discover/styles';

/**
 * Types, functions and definitions for rendering fields in discover results.
 */
type RenderFunctionBaggage = {
  organization: Organization;
  location: Location;
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
  sortField: string | null;
  renderFunc: SpecialFieldRenderFunc;
};

type SpecialFields = {
  issue: SpecialField;
  assignee: SpecialField;
  lifetimeCount: SpecialField;
  lifetimeUserCount: SpecialField;
  count: SpecialField;
  userCount: SpecialField;
  firstSeen: SpecialField;
  lastSeen: SpecialField;
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
  lifetimeCount: {
    sortField: null,
    renderFunc: data => issuesCountRenderer(data, 'lifetimeCount'),
  },
  lifetimeUserCount: {
    sortField: null,
    renderFunc: data => issuesCountRenderer(data, 'lifetimeUserCount'),
  },
  count: {
    sortField: null,
    renderFunc: data => issuesCountRenderer(data, 'count'),
  },
  userCount: {
    sortField: null,
    renderFunc: data => issuesCountRenderer(data, 'userCount'),
  },
  firstSeen: {
    sortField: null,
    renderFunc: ({firstSeen}) => <StyledDateTime date={firstSeen} />,
  },
  lastSeen: {
    sortField: null,
    renderFunc: ({lastSeen}) => <StyledDateTime date={lastSeen} />,
  },
};

const issuesCountRenderer = (
  data: EventData,
  field: 'count' | 'userCount' | 'lifetimeCount' | 'lifetimeUserCount'
) => {
  const {selectionDateString} = data;
  const isUserField = !!/user/i.exec(field.toLowerCase());
  const primaryCount = data[field];
  const count = data[isUserField ? 'userCount' : 'count'];
  const lifetimeCount = data[isUserField ? 'lifetimeUserCount' : 'lifetimeCount'];
  const filteredCount = data[isUserField ? 'filteredUserCount' : 'filteredCount'];
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
                <StyledContent>
                  {t('Matching search filters')}
                  <WrappedCount value={filteredCount} />
                </StyledContent>
                <Divider />
              </React.Fragment>
            ) : null}
            <StyledContent>
              {t(`Total in ${selectionDateString}`)}
              <WrappedCount value={count} />
            </StyledContent>
            <Divider />
            <StyledContent>
              {t('Since issue began')}
              <WrappedCount value={lifetimeCount} />
            </StyledContent>
          </div>
        }
      >
        <span>
          {['count', 'userCount'].includes(field) && filteredCount ? (
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

const contentStyle = css`
  width: 100%;
  justify-content: space-between;
  display: flex;
  padding: 6px 10px;
`;

const StyledContent = styled('div')`
  ${contentStyle};
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

const StyledDateTime = styled(DateTime)`
  white-space: nowrap;
`;

const ActorContainer = styled('div')`
  display: flex;
  justify-content: left;
  margin-left: 18px;
  :hover {
    cursor: default;
  }
`;

/**
 * Get the field renderer for the named field and metadata
 *
 * @param {String} field name
 * @param {object} metadata mapping.
 * @returns {Function}
 */
export function getIssueFieldRenderer(
  field: string,
  meta: MetaType
): FieldFormatterRenderFunctionPartial {
  if (SPECIAL_FIELDS.hasOwnProperty(field)) {
    return SPECIAL_FIELDS[field].renderFunc;
  }

  const fieldType = meta[field];

  // Defaults to fieldRenderer formatters if the field is not a special issue field
  if (FIELD_FORMATTERS.hasOwnProperty(fieldType)) {
    return partial(FIELD_FORMATTERS[fieldType].renderFunc, field);
  }
  return partial(FIELD_FORMATTERS.string.renderFunc, field);
}
