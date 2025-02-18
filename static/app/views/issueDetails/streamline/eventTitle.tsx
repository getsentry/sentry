import 'intersection-observer'; // polyfill
import {
  type CSSProperties,
  forwardRef,
  Fragment,
  useEffect,
  useState,
  createContext,
  useContext,
  useCallback,
} from 'react';
import {css, type SerializedStyles, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {useActionableItems} from 'sentry/components/events/interfaces/crashContent/exception/useActionableItems';
import ExternalLink from 'sentry/components/links/externalLink';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import TimeSince from 'sentry/components/timeSince';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  getAnalyticsDataForEvent,
  getAnalyticsDataForGroup,
  getShortEventId,
} from 'sentry/utils/events';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {Divider} from 'sentry/views/issueDetails/divider';
import EventCreatedTooltip from 'sentry/views/issueDetails/eventCreatedTooltip';
import {
  type SectionConfig,
  SectionKey,
  useIssueDetails,
} from 'sentry/views/issueDetails/streamline/context';
import {getFoldSectionKey} from 'sentry/views/issueDetails/streamline/foldSection';

type EventNavigationProps = {
  event: Event;
  group: Group;
  className?: string;
  /**
   * Data property to help style the component when it's sticky
   */
  'data-stuck'?: boolean;
  style?: CSSProperties;
};

const sectionLabels: Partial<Record<SectionKey, string>> = {
  [SectionKey.HIGHLIGHTS]: t('Highlights'),
  [SectionKey.STACKTRACE]: t('Stack Trace'),
  [SectionKey.EXCEPTION]: t('Stack Trace'),
  [SectionKey.THREADS]: t('Stack Trace'),
  [SectionKey.REPLAY]: t('Replay'),
  [SectionKey.BREADCRUMBS]: t('Breadcrumbs'),
  [SectionKey.TRACE]: t('Trace'),
  [SectionKey.TAGS]: t('Tags'),
  [SectionKey.CONTEXTS]: t('Context'),
  [SectionKey.USER_FEEDBACK]: t('User Feedback'),
  [SectionKey.FEATURE_FLAGS]: t('Flags'),
};

export const MIN_NAV_HEIGHT = 44;

type SectionVisibility = {
  activeSection: string | null;
  setIntersectionRatio: (sectionId: string, ratio: number) => void;
};

/**
 * Context for tracking which sections are visible in the viewport and which section
 * should be considered "active" (most visible) for highlighting in the navigation.
 *
 * This context allows child components to:
 * 1. Access the currently active section
 * 2. Update intersection ratios for their sections
 */
const SectionVisibilityContext = createContext<SectionVisibility>({
  activeSection: null,
  setIntersectionRatio: () => {},
});

/**
 * Hook that manages the visibility state of all sections and determines which section
 * should be considered "active" based on their intersection ratios.
 *
 * The hook maintains two pieces of state:
 * 1. A map of section IDs to their current intersection ratios
 * 2. The currently active section ID (the one with highest intersection ratio)
 *
 * @returns {Object} An object containing:
 *   - activeSection: The ID of the section with highest intersection ratio, or null if no sections visible
 *   - setIntersectionRatio: Function to update a section's intersection ratio
 */
function useSectionVisibility() {
  // Track intersection ratios for all sections (0 to 1)
  const [_sectionRatios, setSectionRatios] = useState<Record<string, number>>({});
  // Track which section is currently most visible
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Update which section should be considered active based on intersection ratios
  const updateActiveSection = useCallback((ratios: Record<string, number>) => {
    let maxRatio = 0;
    let maxSection: string | null = null;

    // Find the section with the highest intersection ratio
    Object.entries(ratios).forEach(([section, ratio]) => {
      if (ratio > maxRatio) {
        maxRatio = ratio;
        maxSection = section;
      }
    });

    // Only consider a section active if it has some visibility (ratio > 0)
    if (maxRatio > 0) {
      setActiveSection(maxSection);
    } else {
      setActiveSection(null);
    }
  }, []);

  // Update a section's intersection ratio and recalculate active section
  const setIntersectionRatio = useCallback(
    (sectionId: string, ratio: number) => {
      setSectionRatios(prev => {
        const next = {...prev, [sectionId]: ratio};
        updateActiveSection(next);
        return next;
      });
    },
    [updateActiveSection]
  );

  return {activeSection, setIntersectionRatio};
}

/**
 * Hook that sets up an IntersectionObserver to track how much of a section is visible
 * in the viewport. The observer uses multiple thresholds to accurately track the
 * intersection ratio as the user scrolls.
 *
 * The hook will:
 * 1. Find the DOM element for the section by ID
 * 2. Create an IntersectionObserver to track its visibility
 * 3. Update the section's intersection ratio in the SectionVisibilityContext
 * 4. Clean up the observer when the component unmounts
 *
 * @param elementId - The ID of the DOM element to observe
 */
function useIntersectionObserver(elementId: string) {
  const {setIntersectionRatio} = useContext(SectionVisibilityContext);

  useEffect(() => {
    const element = document.getElementById(elementId);
    if (!element) {
      return;
    }

    // Create observer with multiple thresholds for smooth tracking
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry) {
          setIntersectionRatio(elementId, entry.intersectionRatio);
        }
      },
      {
        // Use many thresholds to track intersection ratio precisely
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      }
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [elementId, setIntersectionRatio]);
}

export const EventTitle = forwardRef<HTMLDivElement, EventNavigationProps>(
  function EventNavigation({event, group, ...props}, ref) {
    const organization = useOrganization();
    const theme = useTheme();

    const {sectionData} = useIssueDetails();
    const eventSectionConfigs = Object.values(sectionData ?? {}).filter(
      config => sectionLabels[config.key]
    );
    const [_isEventErrorCollapsed, setEventErrorCollapsed] = useSyncedLocalStorageState(
      getFoldSectionKey(SectionKey.PROCESSING_ERROR),
      true
    );

    const {data: actionableItems} = useActionableItems({
      eventId: event.id,
      orgSlug: organization.slug,
      projectSlug: group.project.slug,
    });

    const hasEventError = actionableItems?.errors && actionableItems.errors.length > 0;

    const baseEventsPath = `/organizations/${organization.slug}/issues/${group.id}/events/`;

    const grayText = css`
      color: ${theme.subText};
      font-weight: ${theme.fontWeightNormal};
    `;

    const host = organization.links.regionUrl;
    const jsonUrl = `${host}/api/0/projects/${organization.slug}/${group.project.slug}/events/${event.id}/json/`;

    const downloadJson = () => {
      window.open(jsonUrl);
      trackAnalytics('issue_details.event_json_clicked', {
        organization,
        group_id: parseInt(`${event.groupID}`, 10),
        streamline: true,
      });
    };

    const {onClick: copyLink} = useCopyToClipboard({
      successMessage: t('Event URL copied to clipboard'),
      text: window.location.origin + normalizeUrl(`${baseEventsPath}${event.id}/`),
      onCopy: () =>
        trackAnalytics('issue_details.copy_event_link_clicked', {
          organization,
          ...getAnalyticsDataForGroup(group),
          ...getAnalyticsDataForEvent(event),
          streamline: true,
        }),
    });

    const {onClick: copyEventId} = useCopyToClipboard({
      successMessage: t('Event ID copied to clipboard'),
      text: event.id,
      onCopy: () =>
        trackAnalytics('issue_details.copy_event_id_clicked', {
          organization,
          ...getAnalyticsDataForGroup(group),
          ...getAnalyticsDataForEvent(event),
          streamline: true,
        }),
    });

    const sectionVisibility = useSectionVisibility();

    return (
      <SectionVisibilityContext.Provider value={sectionVisibility}>
        <div {...props} ref={ref}>
          <EventInfoJumpToWrapper>
            <EventInfo>
              <DropdownMenu
                trigger={(triggerProps, isOpen) => (
                  <EventIdDropdownButton
                    {...triggerProps}
                    aria-label={t('Event actions')}
                    size="sm"
                    borderless
                    isOpen={isOpen}
                  >
                    {getShortEventId(event.id)}
                  </EventIdDropdownButton>
                )}
                position="bottom-start"
                offset={4}
                size="xs"
                items={[
                  {
                    key: 'copy-event-id',
                    label: t('Copy Event ID'),
                    onAction: copyEventId,
                  },
                  {
                    key: 'copy-event-link',
                    label: t('Copy Event Link'),
                    onAction: copyLink,
                  },
                  {
                    key: 'view-json',
                    label: t('View JSON'),
                    onAction: downloadJson,
                    className: 'hidden-sm hidden-md hidden-lg',
                  },
                ]}
              />
              <StyledTimeSince
                tooltipBody={<EventCreatedTooltip event={event} />}
                tooltipProps={{maxWidth: 300, isHoverable: true}}
                date={event.dateCreated ?? event.dateReceived}
                css={grayText}
                aria-label={t('Event timestamp')}
              />
              <JsonLinkWrapper className="hidden-xs">
                <Divider />
                <JsonLink
                  href={jsonUrl}
                  onClick={() =>
                    trackAnalytics('issue_details.event_json_clicked', {
                      organization,
                      group_id: parseInt(`${event.groupID}`, 10),
                      streamline: true,
                    })
                  }
                >
                  {t('JSON')}
                </JsonLink>
              </JsonLinkWrapper>
              {hasEventError && (
                <Fragment>
                  <Divider />
                  <ProcessingErrorButton
                    title={t(
                      'Sentry has detected configuration issues with this event. Click for more info.'
                    )}
                    borderless
                    size="zero"
                    icon={<IconWarning color="red300" />}
                    onClick={() => {
                      document
                        .getElementById(SectionKey.PROCESSING_ERROR)
                        ?.scrollIntoView({block: 'start', behavior: 'smooth'});
                      setEventErrorCollapsed(false);
                    }}
                  >
                    {t('Processing Error')}
                  </ProcessingErrorButton>
                </Fragment>
              )}
            </EventInfo>
            {eventSectionConfigs.length > 0 && (
              <JumpTo>
                <div aria-hidden>{t('Jump to:')}</div>
                <ScrollCarousel gap={0.25} aria-label={t('Jump to section links')}>
                  {eventSectionConfigs.map(config => (
                    <EventNavigationLink
                      key={config.key}
                      config={config}
                      propCss={grayText}
                    />
                  ))}
                </ScrollCarousel>
              </JumpTo>
            )}
          </EventInfoJumpToWrapper>
        </div>
      </SectionVisibilityContext.Provider>
    );
  }
);

function EventNavigationLink({
  config,
  propCss,
}: {
  config: SectionConfig;
  propCss: SerializedStyles;
}) {
  const theme = useTheme();
  const [_isCollapsed, setIsCollapsed] = useSyncedLocalStorageState(
    getFoldSectionKey(config.key),
    config?.initialCollapse ?? false
  );
  const {activeSection} = useContext(SectionVisibilityContext);
  useIntersectionObserver(config.key);

  const activeCss = css`
    color: ${theme.activeText} !important;
    font-weight: ${theme.fontWeightBold};
  `;

  const isActive = activeSection === config.key;

  return (
    <LinkButton
      to={{
        ...location,
        hash: `#${config.key}`,
      }}
      onClick={event => {
        event.preventDefault();
        setIsCollapsed(false);
        document
          .getElementById(config.key)
          ?.scrollIntoView({block: 'start', behavior: 'smooth'});
      }}
      borderless
      size="xs"
      css={[propCss, isActive && activeCss]}
      data-active={isActive ? 'true' : 'false'}
      analyticsEventName="Issue Details: Jump To Clicked"
      analyticsEventKey="issue_details.jump_to_clicked"
      analyticsParams={{section: config.key}}
    >
      {sectionLabels[config.key]}
    </LinkButton>
  );
}

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightNormal};
  white-space: nowrap;
`;

const EventInfoJumpToWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 0 ${space(2)} 0 ${space(0.5)};
  flex-wrap: wrap;
  min-height: ${MIN_NAV_HEIGHT}px;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex-wrap: nowrap;
  }
  border-bottom: 1px solid ${p => p.theme.translucentBorder};
`;

const EventIdDropdownButton = styled(DropdownButton)`
  padding-right: ${space(0.5)};
`;

const EventInfo = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  flex-direction: row;
  align-items: center;
  line-height: 1.2;
`;

const JumpTo = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: row;
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  white-space: nowrap;
  max-width: 100%;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    max-width: 50%;
  }
`;

const ProcessingErrorButton = styled(Button)`
  color: ${p => p.theme.red300};
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeSmall};
  :hover {
    color: ${p => p.theme.red300};
  }
`;

const JsonLinkWrapper = styled('div')`
  display: flex;
  gap: ${space(0.5)};
`;

const JsonLink = styled(ExternalLink)`
  color: ${p => p.theme.gray300};
  text-decoration: underline;
  text-decoration-color: ${p => p.theme.translucentGray200};

  :hover {
    color: ${p => p.theme.gray300};
  }
`;
