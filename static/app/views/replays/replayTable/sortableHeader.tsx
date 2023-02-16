import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconArrow} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';
import {ReplayRecord} from 'sentry/views/replays/types';

type NotSortable = {
  label: string;
  tooltip?: string;
};

type Sortable = {
  fieldName: keyof ReplayRecord;
  label: string;
  sort: undefined | Sort;
  tooltip?: string;
};

type Props = NotSortable | Sortable;

function SortableHeader(props: Props) {
  const location = useLocation<ReplayListLocationQuery>();
  const organization = useOrganization();

  if (!('sort' in props) || !props.sort) {
    const {label, tooltip} = props;
    return (
      <Header>
        {label}
        {tooltip ? (
          <StyledQuestionTooltip size="xs" position="top" title={tooltip} />
        ) : null}
      </Header>
    );
  }

  const {fieldName, label, sort, tooltip} = props;

  const arrowDirection = sort?.kind === 'asc' ? 'up' : 'down';
  const sortArrow = <IconArrow color="gray300" size="xs" direction={arrowDirection} />;

  return (
    <Header>
      <SortLink
        role="columnheader"
        aria-sort={
          sort?.field.endsWith(fieldName)
            ? sort?.kind === 'asc'
              ? 'ascending'
              : 'descending'
            : 'none'
        }
        onClick={() => {
          const column = sort?.field.endsWith(fieldName)
            ? sort?.kind === 'desc'
              ? fieldName
              : '-' + fieldName
            : '-' + fieldName;
          trackAdvancedAnalyticsEvent('replay.list-sorted', {
            organization,
            column,
          });
        }}
        to={{
          pathname: location.pathname,
          query: {
            ...location.query,
            sort: sort?.field.endsWith(fieldName)
              ? sort?.kind === 'desc'
                ? fieldName
                : '-' + fieldName
              : '-' + fieldName,
          },
        }}
      >
        {label} {sort?.field === fieldName && sortArrow}
      </SortLink>
      {tooltip ? (
        <StyledQuestionTooltip size="xs" position="top" title={tooltip} />
      ) : null}
    </Header>
  );
}

const Header = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  align-items: center;
`;

const SortLink = styled(Link)`
  color: inherit;

  :hover {
    color: inherit;
  }

  svg {
    vertical-align: top;
  }
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  margin-left: ${space(0.5)};
`;

export default SortableHeader;
