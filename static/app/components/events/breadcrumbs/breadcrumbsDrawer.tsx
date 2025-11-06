import {useCallback, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {ProjectAvatar} from '@sentry/scraps/avatar';

import {addSuccessMessage, addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import BreadcrumbsTimeline from 'sentry/components/events/breadcrumbs/breadcrumbsTimeline';
import {
  BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
  BREADCRUMB_TIME_DISPLAY_OPTIONS,
  BreadcrumbTimeDisplay,
  useBreadcrumbFilters,
  type EnhancedCrumb,
} from 'sentry/components/events/breadcrumbs/utils';
import {
  CrumbContainer,
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
  SearchInput,
  ShortId,
} from 'sentry/components/events/eventDrawer';
import {
  applyBreadcrumbSearch,
  BREADCRUMB_SORT_LOCALSTORAGE_KEY,
  BREADCRUMB_SORT_OPTIONS,
  BreadcrumbSort,
} from 'sentry/components/events/interfaces/breadcrumbs';
import useFocusControl from 'sentry/components/events/useFocusControl';
import {IconClock, IconCopy, IconFilter, IconSearch, IconSort, IconTimer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getShortEventId} from 'sentry/utils/events';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';

export const enum BreadcrumbControlOptions {
  SEARCH = 'search',
  FILTER = 'filter',
  SORT = 'sort',
}

interface BreadcrumbsDrawerProps {
  breadcrumbs: EnhancedCrumb[];
  event: Event;
  group: Group;
  project: Project;
  focusControl?: BreadcrumbControlOptions;
}

/**
 * Formats breadcrumbs for copying to clipboard in a human-readable format
 */
function formatBreadcrumbsForCopy(
  breadcrumbs: EnhancedCrumb[],
  timeDisplay: BreadcrumbTimeDisplay,
  startTimeString?: string
): string {
  if (breadcrumbs.length === 0) {
    return '';
  }

  const lines: string[] = [];
  
  // Add header
  lines.push('BREADCRUMBS');
  lines.push('='.repeat(50));
  lines.push('');

  breadcrumbs.forEach((crumb, index) => {
    const {breadcrumb, title} = crumb;
    
    // Format timestamp
    let timestamp = '';
    if (breadcrumb.timestamp) {
      if (timeDisplay === BreadcrumbTimeDisplay.RELATIVE && startTimeString) {
        // Calculate relative time from start
        const startTime = new Date(startTimeString).getTime();
        const crumbTime = new Date(breadcrumb.timestamp).getTime();
        const diffMs = crumbTime - startTime;
        
        if (diffMs === 0) {
          timestamp = '0ms';
        } else if (Math.abs(diffMs) < 60000) {
          // Less than 1 minute, show milliseconds
          timestamp = `${diffMs > 0 ? '+' : ''}${diffMs}ms`;
        } else {
          // More than 1 minute, show minutes and seconds
          const diffSeconds = Math.floor(diffMs / 1000);
          const minutes = Math.floor(diffSeconds / 60);
          const seconds = diffSeconds % 60;
          timestamp = `${diffSeconds > 0 ? '+' : ''}${minutes}min ${Math.abs(seconds)}s`;
        }
      } else {
        // Use absolute timestamp in a readable format
        const date = new Date(breadcrumb.timestamp);
        timestamp = date.toLocaleString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          fractionalSecondDigits: 3,
          hour12: false,
        });
      }
    }

    // Format breadcrumb line
    const level = breadcrumb.level ? `[${breadcrumb.level.toUpperCase()}]` : '';
    const category = breadcrumb.category || title;
    const message = breadcrumb.message || '';
    
    let breadcrumbLine = `${index + 1}.`;
    if (timestamp) {
      breadcrumbLine += ` ${timestamp}`;
    }
    if (level) {
      breadcrumbLine += ` ${level}`;
    }
    breadcrumbLine += ` ${category}`;
    if (message && message !== category) {
      breadcrumbLine += ` - ${message}`;
    }
    lines.push(breadcrumbLine);
    
    // Add data if present and relevant
    if (breadcrumb.data && Object.keys(breadcrumb.data).length > 0) {
      try {
        const dataStr = JSON.stringify(breadcrumb.data, null, 2);
        // Only include data if it's not too large and contains useful info
        if (dataStr.length < 500) {
          lines.push(`   Data: ${JSON.stringify(breadcrumb.data)}`);
        } else {
          lines.push(`   Data: [Large object with ${Object.keys(breadcrumb.data).length} properties]`);
        }
      } catch {
        lines.push('   Data: [Unable to serialize data]');
      }
    }
    
    lines.push(''); // Empty line between breadcrumbs
  });
  
  // Add footer info
  lines.push('='.repeat(50));
  lines.push(`Total: ${breadcrumbs.length} breadcrumb${breadcrumbs.length !== 1 ? 's' : ''}`);
  
  return lines.join('\n');
}

/**
 * Copies text to clipboard with fallback for older browsers
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // Modern Clipboard API (preferred)
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for older browsers or non-secure contexts
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, 99999); // For mobile devices
    
    const result = document.execCommand('copy');
    document.body.removeChild(textArea);
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

export function BreadcrumbsDrawer({
  breadcrumbs,
  event,
  project,
  group,
  focusControl: initialFocusControl,
}: BreadcrumbsDrawerProps) {
  const organization = useOrganization();
  const theme = useTheme();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<string[]>([]);
  const [sort, setSort] = useLocalStorageState<BreadcrumbSort>(
    BREADCRUMB_SORT_LOCALSTORAGE_KEY,
    BreadcrumbSort.NEWEST
  );
  const {getFocusProps} = useFocusControl(initialFocusControl);

  const [timeDisplay, setTimeDisplay] = useLocalStorageState<BreadcrumbTimeDisplay>(
    BREADCRUMB_TIME_DISPLAY_LOCALSTORAGE_KEY,
    BreadcrumbTimeDisplay.ABSOLUTE
  );
  const {filterOptions, applyFilters} = useBreadcrumbFilters(breadcrumbs);

  const displayCrumbs = useMemo(() => {
    const sortedCrumbs =
      sort === BreadcrumbSort.OLDEST ? breadcrumbs : [...breadcrumbs].reverse();
    const filteredCrumbs = applyFilters(sortedCrumbs, filters);
    const searchedCrumbs = applyBreadcrumbSearch(filteredCrumbs, search);
    return searchedCrumbs;
  }, [breadcrumbs, sort, filters, search, applyFilters]);

  const startTimeString = useMemo(
    () =>
      timeDisplay === BreadcrumbTimeDisplay.RELATIVE
        ? displayCrumbs?.at(0)?.breadcrumb?.timestamp
        : undefined,
    [displayCrumbs, timeDisplay]
  );

  const handleCopyAllBreadcrumbs = useCallback(async () => {
    if (displayCrumbs.length === 0) {
      addErrorMessage(t('No breadcrumbs to copy'));
      return;
    }

    setIsCopying(true);
    
    try {
      const formattedText = formatBreadcrumbsForCopy(
        displayCrumbs,
        timeDisplay,
        startTimeString
      );
      
      const success = await copyToClipboard(formattedText);
      
      if (success) {
        addSuccessMessage(
          t('Copied %s breadcrumb%s to clipboard', displayCrumbs.length, displayCrumbs.length !== 1 ? 's' : '')
        );
        trackAnalytics('breadcrumbs.drawer.copy_all', {
          organization,
          count: displayCrumbs.length,
          timeDisplay,
          hasFilters: filters.length > 0,
          hasSearch: search.length > 0,
        });
      } else {
        throw new Error('Copy failed');
      }
    } catch {
      addErrorMessage(t('Failed to copy breadcrumbs to clipboard'));
      trackAnalytics('breadcrumbs.drawer.copy_all_failed', {
        organization,
        count: displayCrumbs.length,
      });
    } finally {
      setIsCopying(false);
    }
  }, [displayCrumbs, timeDisplay, startTimeString, filters, search, organization]);

  const actions = (
    <ButtonBar>
      <InputGroup>
        <SearchInput
          size="xs"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            trackAnalytics('breadcrumbs.drawer.action', {
              control: BreadcrumbControlOptions.SEARCH,
              organization,
            });
          }}
          aria-label={t('Search All Breadcrumbs')}
          {...getFocusProps(BreadcrumbControlOptions.SEARCH)}
        />
        <InputGroup.TrailingItems disablePointerEvents>
          <IconSearch size="xs" />
        </InputGroup.TrailingItems>
      </InputGroup>
      <CompactSelect
        size="xs"
        onChange={options => {
          const newFilters = options.map(({value}) => value);
          setFilters(newFilters);
          trackAnalytics('breadcrumbs.drawer.action', {
            control: BreadcrumbControlOptions.FILTER,
            organization,
          });
        }}
        multiple
        options={filterOptions}
        maxMenuHeight={400}
        trigger={props => (
          <VisibleFocusButton
            size="xs"
            borderless
            style={{background: filters.length > 0 ? theme.purple100 : 'transparent'}}
            icon={<IconFilter />}
            aria-label={t('Filter All Breadcrumbs')}
            {...props}
            {...getFocusProps(BreadcrumbControlOptions.FILTER)}
          >
            {filters.length > 0 ? filters.length : null}
          </VisibleFocusButton>
        )}
      />
      <CompactSelect
        size="xs"
        trigger={props => (
          <VisibleFocusButton
            size="xs"
            borderless
            icon={<IconSort />}
            aria-label={t('Sort All Breadcrumbs')}
            {...props}
            {...getFocusProps(BreadcrumbControlOptions.SORT)}
          />
        )}
        onChange={selectedOption => {
          setSort(selectedOption.value);
          trackAnalytics('breadcrumbs.drawer.action', {
            control: BreadcrumbControlOptions.SORT,
            value: selectedOption.value,
            organization,
          });
        }}
        value={sort}
        options={BREADCRUMB_SORT_OPTIONS}
      />
      <CompactSelect
        size="xs"
        trigger={props => (
          <Button
            size="xs"
            borderless
            icon={
              timeDisplay === BreadcrumbTimeDisplay.ABSOLUTE ? (
                <IconClock size="xs" />
              ) : (
                <IconTimer size="xs" />
              )
            }
            aria-label={t('Change Time Format for All Breadcrumbs')}
            {...props}
          />
        )}
        onChange={selectedOption => {
          setTimeDisplay(selectedOption.value);
          trackAnalytics('breadcrumbs.drawer.action', {
            control: 'time_display',
            value: selectedOption.value,
            organization,
          });
        }}
        value={timeDisplay}
        options={Object.values(BREADCRUMB_TIME_DISPLAY_OPTIONS)}
      />
      <Button
        size="xs"
        borderless
        icon={<IconCopy />}
        aria-label={t('Copy All Breadcrumbs')}
        title={t('Copy all visible breadcrumbs to clipboard')}
        disabled={isCopying || displayCrumbs.length === 0}
        onClick={handleCopyAllBreadcrumbs}
      >
        {isCopying ? t('Copying...') : null}
      </Button>
    </ButtonBar>
  );

  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <NavigationCrumbs
          crumbs={[
            {
              label: (
                <CrumbContainer>
                  <ProjectAvatar project={project} />
                  <ShortId>{group.shortId}</ShortId>
                </CrumbContainer>
              ),
            },
            {label: getShortEventId(event.id)},
            {label: t('Breadcrumbs')},
          ]}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{t('Breadcrumbs')}</Header>
        {actions}
      </EventNavigator>
      <EventDrawerBody ref={setContainer}>
        <TimelineContainer>
          {displayCrumbs.length === 0 ? (
            <EmptyMessage>
              {t('No breadcrumbs found.')}
              <Button
                priority="link"
                onClick={() => {
                  setFilters([]);
                  setSearch('');
                  trackAnalytics('breadcrumbs.drawer.action', {
                    control: 'clear_filters',
                    organization,
                  });
                }}
              >
                {t('Clear Filters?')}
              </Button>
            </EmptyMessage>
          ) : (
            <BreadcrumbsTimeline
              breadcrumbs={displayCrumbs}
              startTimeString={startTimeString}
              containerElement={container}
            />
          )}
        </TimelineContainer>
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}

const VisibleFocusButton = styled(Button)`
  box-shadow: ${p => (p.autoFocus ? p.theme.button.default.focusBorder : 'transparent')} 0
    0 0 1px;
`;

const TimelineContainer = styled('div')`
  grid-column: span 2;
`;

const EmptyMessage = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: ${p => p.theme.subText};
  padding: ${space(3)} ${space(1)};
`;