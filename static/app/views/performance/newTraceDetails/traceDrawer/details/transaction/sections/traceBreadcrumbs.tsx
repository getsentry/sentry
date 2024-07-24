import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {
  BreadcrumbControlOptions,
  EmptyBreadcrumbMessage,
  useBreadcrumbControls,
} from 'sentry/components/events/breadcrumbs/breadcrumbsDrawerContent';
import BreadcrumbsTimeline from 'sentry/components/events/breadcrumbs/breadcrumbsTimeline';
import {
  BREADCRUMB_TIME_DISPLAY_OPTIONS,
  BreadcrumbTimeDisplay,
  getEnhancedBreadcrumbs,
} from 'sentry/components/events/breadcrumbs/utils';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {BREADCRUMB_SORT_OPTIONS} from 'sentry/components/events/interfaces/breadcrumbs';
import {InputGroup} from 'sentry/components/inputGroup';
import {LazyRender} from 'sentry/components/lazyRender';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconClock, IconFilter, IconSearch, IconSort, IconTimer} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {EventTransaction, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';

import {TraceDrawerComponents} from '../../styles';

export function TraceBreadcrumbs({
  event,
  organization,
}: {
  event: EventTransaction;
  organization: Organization;
}) {
  const theme = useTheme();
  const enhancedCrumbs = useMemo(() => getEnhancedBreadcrumbs(event), [event]);

  const {
    search,
    setSearch,
    filterSet,
    setFilterSet,
    filterOptions,
    sort,
    setSort,
    timeDisplay,
    setTimeDisplay,
    displayCrumbs,
    startTimeString,
  } = useBreadcrumbControls({enhancedCrumbs});

  if (enhancedCrumbs.length === 0) {
    return null;
  }

  const actions = (
    <ButtonBar gap={1}>
      <InputGroup>
        <InputGroup.Input
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
        />
        <InputGroup.TrailingItems disablePointerEvents>
          <IconSearch size="xs" />
        </InputGroup.TrailingItems>
      </InputGroup>
      <CompactSelect
        size="xs"
        onChange={options => {
          const newFilters = options.map(({value}) => value);
          setFilterSet(new Set(newFilters));
          trackAnalytics('breadcrumbs.trace_view.action', {
            control: BreadcrumbControlOptions.FILTER,
            organization,
          });
        }}
        multiple
        options={filterOptions}
        maxMenuHeight={400}
        trigger={props => (
          <Button
            size="xs"
            style={{background: filterSet.size > 0 ? theme.purple100 : 'transparent'}}
            icon={<IconFilter />}
            aria-label={t('Filter All Breadcrumbs')}
            {...props}
          >
            {filterSet.size > 0 ? filterSet.size : null}
          </Button>
        )}
      />
      <CompactSelect
        size="xs"
        trigger={props => (
          <Button
            size="xs"
            icon={<IconSort />}
            aria-label={t('Sort All Breadcrumbs')}
            {...props}
          />
        )}
        onChange={selectedOption => {
          setSort(selectedOption.value);
          trackAnalytics('breadcrumbs.trace_view.action', {
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
          trackAnalytics('breadcrumbs.trace_view.action', {
            control: 'time_display',
            value: selectedOption.value,
            organization,
          });
        }}
        value={timeDisplay}
        options={BREADCRUMB_TIME_DISPLAY_OPTIONS}
      />
    </ButtonBar>
  );

  return (
    <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={200}>
      <EventDataSection
        showPermalink={false}
        key="breadcrumbs"
        type="breadcrumbs"
        title={t('Breadcrumbs')}
        help={tct(
          'The trail of events that happened prior to an event. [link:Learn more]',
          {
            link: (
              <ExternalLink
                openInNewTab
                href={'https://docs.sentry.io/product/issues/issue-details/breadcrumbs/'}
              />
            ),
          }
        )}
        isHelpHoverable
        actions={actions}
      >
        <ErrorBoundary
          mini
          message={t('There was an error loading the event breadcrumbs')}
        >
          {displayCrumbs.length === 0 ? (
            <EmptyBreadcrumbMessage
              onClear={() => {
                setFilterSet(new Set());
                setSearch('');
                trackAnalytics('breadcrumbs.trace_view.action', {
                  control: 'clear_filters',
                  organization,
                });
              }}
            />
          ) : (
            <BreadcrumbsTimeline
              breadcrumbs={displayCrumbs}
              startTimeString={startTimeString}
              fixedHeight={400}
              isCompact
            />
          )}
        </ErrorBoundary>
      </EventDataSection>
    </LazyRender>
  );
}
