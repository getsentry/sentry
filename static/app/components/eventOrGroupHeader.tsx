import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';
import {useHover} from '@react-aria/interactions';

import {Link} from 'sentry/components/core/link';
import ErrorBoundary from 'sentry/components/errorBoundary';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventMessage from 'sentry/components/events/eventMessage';
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
            <IconStar isSolid variant="warning" />
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
      'data-test-id': status === 'resolved' ? 'resolved-issue' : undefined,
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
  font-size: ${p => p.theme.fontSize.lg};
  & em {
    font-size: ${p => p.theme.fontSize.md};
    font-style: normal;
    font-weight: ${p => p.theme.fontWeight.normal};
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
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${p => p.theme.tokens.content.primary};

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const TitleWithoutLink = styled('span')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export default EventOrGroupHeader;

const StyledEventOrGroupTitle = styled(EventOrGroupTitle)`
  font-weight: ${p => p.theme.fontWeight.bold};
`;
