import {useRef} from 'react';
import styled from '@emotion/styled';
import {useHover} from '@react-aria/interactions';

import {Link} from '@sentry/scraps/link';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventMessage} from 'sentry/components/events/eventMessage';
import {GroupTitle} from 'sentry/components/groupTitle';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconStar} from 'sentry/icons';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {getMessage} from 'sentry/utils/events';
import {fetchDataQuery, useQueryClient} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeFetchGroupQueryKey} from 'sentry/views/issueDetails/useGroup';
import {createIssueLink} from 'sentry/views/issueList/utils';

import {EventTitleError} from './eventTitleError';

interface GroupHeaderRowProps {
  data: Group;
  eventId?: string;
  hideIcons?: boolean;
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
 * Displays a group/issue title row (i.e. in Stream)
 */
export function GroupHeaderRow({
  data,
  query,
  onClick,
  hideIcons,
  eventId,
  source,
}: GroupHeaderRowProps) {
  const location = useLocation();
  const organization = useOrganization();

  const preloadHoverProps = usePreloadGroupOnHover({
    groupId: data.id,
    disabled: false,
    organization,
  });

  const to = createIssueLink({
    organization,
    data,
    eventId,
    referrer: source,
    location,
    query,
  });

  return (
    <div data-test-id="event-issue-header">
      <Title>
        <TitleWithLink
          data-test-id={data.status === 'resolved' ? 'resolved-issue' : undefined}
          {...preloadHoverProps}
          to={to}
          onClick={onClick}
          data-issue-title-link
        >
          {!hideIcons && data.isBookmarked && (
            <IconWrapper>
              <IconStar isSolid variant="warning" />
            </IconWrapper>
          )}
          <ErrorBoundary customComponent={() => <EventTitleError />} mini>
            <StyledGroupTitle data={data} withStackTracePreview query={query} />
          </ErrorBoundary>
        </TitleWithLink>
      </Title>
      <StyledEventMessage
        level={data.level}
        message={getMessage(data)}
        type={data.type}
      />
    </div>
  );
}

const Title = styled('div')`
  margin-bottom: ${p => p.theme.space['2xs']};
  font-size: ${p => p.theme.font.size.lg};
  & em {
    font-size: ${p => p.theme.font.size.md};
    font-style: normal;
    font-weight: ${p => p.theme.font.weight.sans.regular};
    color: ${p => p.theme.tokens.content.secondary};
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
  width: fit-content;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${p => p.theme.tokens.content.primary};

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const StyledGroupTitle = styled(GroupTitle)`
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;
