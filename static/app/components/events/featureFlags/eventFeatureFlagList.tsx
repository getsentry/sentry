import {useCallback, useMemo, useRef, useState} from 'react';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {
  CardContainer,
  FeatureFlagDrawer,
  FLAG_SORT_OPTIONS,
  FlagControlOptions,
  FlagSort,
  getLabel,
} from 'sentry/components/events/featureFlags/featureFlagDrawer';
import useDrawer from 'sentry/components/globalDrawer';
import KeyValueData, {
  type KeyValueDataContentProps,
} from 'sentry/components/keyValueData';
import {IconMegaphone, IconSearch, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event, FeatureFlag} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

export function EventFeatureFlagList({
  event,
  group,
  project,
}: {
  event: Event;
  group: Group;
  project: Project;
}) {
  const openForm = useFeedbackForm();
  const feedbackButton = openForm ? (
    <Button
      aria-label={t('Give feedback on the feature flag section')}
      icon={<IconMegaphone />}
      size={'xs'}
      onClick={() =>
        openForm({
          messagePlaceholder: t('How can we make feature flags work better for you?'),
          tags: {
            ['feedback.source']: 'issue_details_feature_flags',
            ['feedback.owner']: 'replay',
          },
        })
      }
    >
      {t('Give Feedback')}
    </Button>
  ) : null;

  const [sortMethod, setSortMethod] = useState<FlagSort>(FlagSort.NEWEST);
  const {closeDrawer, isDrawerOpen, openDrawer} = useDrawer();
  const viewAllButtonRef = useRef<HTMLButtonElement>(null);
  const organization = useOrganization();

  // Transform the flags array into something readable by the key-value component
  const hydrateFlags = (flags: FeatureFlag[] | undefined): KeyValueDataContentProps[] => {
    if (!flags) {
      return [];
    }
    return flags.map(f => {
      return {
        item: {key: f.flag, subject: f.flag, value: f.result.toString()},
      };
    });
  };

  // Reverse the flags to show newest at the top by default
  const hydratedFlags = useMemo(
    () => hydrateFlags(event.contexts?.flags?.values.reverse()),
    [event]
  );

  const handleSortAlphabetical = (flags: KeyValueDataContentProps[]) => {
    return [...flags].sort((a, b) => {
      return a.item.key.localeCompare(b.item.key);
    });
  };

  const sortedFlags =
    sortMethod === FlagSort.ALPHA
      ? handleSortAlphabetical(hydratedFlags)
      : sortMethod === FlagSort.OLDEST
        ? [...hydratedFlags].reverse()
        : hydratedFlags;

  const onViewAllFlags = useCallback(
    (focusControl?: FlagControlOptions) => {
      trackAnalytics('flags.view-all-clicked', {
        organization,
      });
      openDrawer(
        () => (
          <FeatureFlagDrawer
            group={group}
            event={event}
            project={project}
            hydratedFlags={hydratedFlags}
            initialSort={sortMethod}
            focusControl={focusControl}
          />
        ),
        {
          ariaLabel: t('Feature flags drawer'),
          // We prevent a click on the 'View All' button from closing the drawer so that
          // we don't reopen it immediately, and instead let the button handle this itself.
          shouldCloseOnInteractOutside: element => {
            const viewAllButton = viewAllButtonRef.current;
            if (viewAllButton?.contains(element)) {
              return false;
            }
            return true;
          },
          transitionProps: {stiffness: 1000},
        }
      );
    },
    [openDrawer, event, group, project, sortMethod, hydratedFlags, organization]
  );

  if (!hydratedFlags.length) {
    return null;
  }

  const actions = (
    <ButtonBar gap={1}>
      {feedbackButton}
      <Button
        aria-label={t('Open Feature Flag Search')}
        icon={<IconSearch size="xs" />}
        size="xs"
        title={t('Open Search')}
        onClick={() => onViewAllFlags(FlagControlOptions.SEARCH)}
      />
      <Button
        size="xs"
        aria-label={t('View All')}
        ref={viewAllButtonRef}
        title={t('View All Flags')}
        onClick={() => {
          isDrawerOpen ? closeDrawer() : onViewAllFlags();
        }}
      >
        {t('View All')}
      </Button>
      <CompactSelect
        value={sortMethod}
        options={FLAG_SORT_OPTIONS}
        triggerProps={{
          'aria-label': t('Sort Flags'),
        }}
        onChange={selection => {
          setSortMethod(selection.value);
          trackAnalytics('flags.sort-flags', {
            organization,
            sortMethod: selection.value,
          });
        }}
        trigger={triggerProps => (
          <DropdownButton {...triggerProps} size="xs" icon={<IconSort />}>
            {getLabel(sortMethod)}
          </DropdownButton>
        )}
      />
    </ButtonBar>
  );

  // Split the flags list into two columns for display
  const truncatedItems = sortedFlags.slice(0, 20);
  const columnOne = truncatedItems.slice(0, 10);
  let columnTwo: typeof truncatedItems = [];
  if (truncatedItems.length > 10) {
    columnTwo = truncatedItems.slice(10, 20);
  }

  return (
    <ErrorBoundary mini message={t('There was a problem loading feature flags.')}>
      <InterimSection
        help={t(
          "The last 10 flags evaluated in the user's session leading up to this event."
        )}
        isHelpHoverable
        title={t('Feature Flags')}
        type="feature-flags"
        actions={actions}
      >
        <CardContainer numCols={columnTwo.length ? 2 : 1}>
          <KeyValueData.Card contentItems={columnOne} />
          <KeyValueData.Card contentItems={columnTwo} />
        </CardContainer>
      </InterimSection>
    </ErrorBoundary>
  );
}
