import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';
import {useHover} from '@react-aria/interactions';

import ErrorBoundary from 'sentry/components/errorBoundary';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
import Link from 'sentry/components/links/link';
import {IconStar} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group, GroupTombstoneHelper} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getMessage, isGroup, isTombstone} from 'sentry/utils/events';
import {fetchDataQuery, useQueryClient} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {makeFetchGroupQueryKey} from 'sentry/views/issueDetails/useGroup';
import {createIssueLink} from 'sentry/views/issueList/utils';

import EventTitleError from './eventTitleError';

interface EventOrGroupHeaderProps {
  data: Event | Group | GroupTombstoneHelper;
  eventId?: string;
  hideIcons?: boolean;
  hideLevel?: boolean;
  index?: number;
  /** Group link clicked */
  onClick?: () => void;
  query?: string;
  source?: string;
}

function usePreloadGroupOnHover({
  groupId,
  disabled,
  organization,
}: {
  disabled: boolean;
  groupId: string;
  organization: Organization;
}) {
  const queryClient = useQueryClient();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const {selection} = usePageFilters();

  const {hoverProps} = useHover({
    onHoverStart: () => {
      timeoutRef.current = setTimeout(() => {
        queryClient.prefetchQuery({
          queryKey: makeFetchGroupQueryKey({
            groupId,
            organizationSlug: organization.slug,
            environments: selection.environments,
          }),
          queryFn: fetchDataQuery,
          staleTime: 30_000,
        });
      }, 300);
    },
    onHoverEnd: () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    isDisabled: disabled,
  });

  return hoverProps;
}

/**
 * Displays an event or group/issue title (i.e. in Stream)
 */
function EventOrGroupHeader({
  data,
  index,
  query,
  onClick,
  hideIcons,
  eventId,
  source,
}: EventOrGroupHeaderProps) {
  const location = useLocation();
  const organization = useOrganization();

  const preloadHoverProps = usePreloadGroupOnHover({
    groupId: data.id,
    disabled: isTombstone(data) || !isGroup(data),
    organization,
  });

  function getTitleChildren() {
    const {isBookmarked} = data as Group;
    return (
      <Fragment>
        {!hideIcons && isBookmarked && (
          <IconWrapper>
            <IconStar isSolid color="yellow300" />
          </IconWrapper>
        )}
        <ErrorBoundary customComponent={() => <EventTitleError />} mini>
          <StyledEventOrGroupTitle data={data} withStackTracePreview query={query} />
        </ErrorBoundary>
      </Fragment>
    );
  }

  function getTitle() {
    const {status} = data as Group;

    const commonEleProps = {
      'data-test-id': status === 'resolved' ? 'resolved-issue' : null,
    };

    if (isTombstone(data)) {
      return (
        <TitleWithoutLink {...commonEleProps}>{getTitleChildren()}</TitleWithoutLink>
      );
    }

    const to = createIssueLink({
      organization,
      data,
      eventId,
      referrer: source,
      streamIndex: index,
      location,
      query,
    });

    return (
      <TitleWithLink
        {...commonEleProps}
        {...preloadHoverProps}
        to={to}
        onClick={onClick}
        data-issue-title-link
      >
        {getTitleChildren()}
      </TitleWithLink>
    );
  }

  return (
    <div data-test-id="event-issue-header">
      <Title>{getTitle()}</Title>
      <StyledEventMessage
        data={data}
        level={'level' in data ? data.level : undefined}
        message={getMessage(data)}
        type={data.type}
      />
    </div>
  );
}

const Title = styled('div')`
  margin-bottom: ${space(0.25)};
  font-size: ${p => p.theme.fontSizeLarge};
  & em {
    font-size: ${p => p.theme.fontSizeMedium};
    font-style: normal;
    font-weight: ${p => p.theme.fontWeightNormal};
    color: ${p => p.theme.subText};
  }
`;

const StyledEventMessage = styled(EventMessage)`
  margin: 0 0 5px;
  font-size: inherit;
`;

const IconWrapper = styled('span')`
  position: relative;
  margin-right: 5px;
`;

const TitleWithLink = styled(Link)`
  ${p => p.theme.overflowEllipsis};
  color: ${p => p.theme.textColor};

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const TitleWithoutLink = styled('span')`
  ${p => p.theme.overflowEllipsis};
`;

export default EventOrGroupHeader;

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)`
  font-weight: ${p => p.theme.fontWeightBold};
`;
