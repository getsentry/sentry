import {useCallback, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {
  ALPHA_OPTIONS,
  CardContainer,
  EVAL_ORDER_OPTIONS,
  FeatureFlagDrawer,
  FlagControlOptions,
  FlagSort,
  getDefaultFlagSort,
  getFlagSortLabel,
  getSortGroupLabel,
  SORT_GROUP_OPTIONS,
  sortedFlags,
  SortGroup,
} from 'sentry/components/events/featureFlags/featureFlagDrawer';
import useDrawer from 'sentry/components/globalDrawer';
import KeyValueData from 'sentry/components/keyValueData';
import {IconMegaphone, IconSearch, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event, FeatureFlag} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/useIssueDetailsDiscoverQuery';
import {useOrganizationFlagLog} from 'sentry/views/issueDetails/streamline/useOrganizationFlagLog';
import useSuspectFlags from 'sentry/views/issueDetails/streamline/useSuspectFlags';

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

  const [flagSort, setFlagSort] = useState<FlagSort>(FlagSort.NEWEST);
  const [sortGroup, setSortGroup] = useState<SortGroup>(SortGroup.EVAL_ORDER);
  const {closeDrawer, isDrawerOpen, openDrawer} = useDrawer();
  const viewAllButtonRef = useRef<HTMLButtonElement>(null);
  const organization = useOrganization();
  const eventView = useIssueDetailsEventView({group});
  const {data: rawFlagData} = useOrganizationFlagLog({
    organization,
    query: {
      start: eventView.start,
      end: eventView.end,
      statsPeriod: eventView.statsPeriod,
    },
  });

  const {
    suspectFlags,
    isError: isSuspectError,
    isPending: isSuspectPending,
  } = useSuspectFlags({
    organization,
    firstSeen: group.firstSeen,
    rawFlagData,
    event,
  });

  const suspectFlagNames: Set<string> = useMemo(() => {
    return isSuspectError || isSuspectPending
      ? new Set()
      : new Set(suspectFlags.map(f => f.flag));
  }, [isSuspectError, isSuspectPending, suspectFlags]);

  const hydratedFlags = useMemo(() => {
    // Transform the flags array into something readable by the key-value component
    // Reverse the flags to show newest at the top by default
    const flags: FeatureFlag[] = event.contexts?.flags?.values.toReversed() ?? [];
    return flags.map(f => {
      return {
        item: {
          key: f.flag,
          subject: f.flag,
          value: suspectFlagNames.has(f.flag) ? (
            <ValueWrapper>
              {f.result.toString()}
              <SuspectLabel>{t('Suspect')}</SuspectLabel>
            </ValueWrapper>
          ) : (
            f.result.toString()
          ),
        },
        isSuspectFlag: suspectFlagNames.has(f.flag),
      };
    });
  }, [event, suspectFlagNames]);

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
            initialSortGroup={sortGroup}
            initialFlagSort={flagSort}
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
    [openDrawer, event, group, project, hydratedFlags, organization, flagSort, sortGroup]
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
        value={sortGroup}
        options={SORT_GROUP_OPTIONS}
        triggerProps={{
          'aria-label': t('Sort Group'),
        }}
        onChange={selection => {
          setFlagSort(getDefaultFlagSort(selection.value));
          setSortGroup(selection.value);
        }}
        trigger={triggerProps => (
          <DropdownButton {...triggerProps} size="xs">
            {getSortGroupLabel(sortGroup)}
          </DropdownButton>
        )}
      />
      <CompactSelect
        value={flagSort}
        options={sortGroup === SortGroup.EVAL_ORDER ? EVAL_ORDER_OPTIONS : ALPHA_OPTIONS}
        triggerProps={{
          'aria-label': t('Flag Sort Type'),
        }}
        onChange={selection => {
          setFlagSort(selection.value);
          trackAnalytics('flags.sort-flags', {
            organization,
            sortMethod: selection.value,
          });
        }}
        trigger={triggerProps => (
          <DropdownButton {...triggerProps} size="xs" icon={<IconSort />}>
            {getFlagSortLabel(flagSort)}
          </DropdownButton>
        )}
      />
    </ButtonBar>
  );

  // Split the flags list into two columns for display
  const truncatedItems = sortedFlags({flags: hydratedFlags, sort: flagSort}).slice(0, 20);
  const columnOne = truncatedItems.slice(0, 10);
  let columnTwo: typeof truncatedItems = [];
  if (truncatedItems.length > 10) {
    columnTwo = truncatedItems.slice(10, 20);
  }

  return (
    <ErrorBoundary mini message={t('There was a problem loading feature flags.')}>
      <InterimSection
        help={t(
          "The last 100 flags evaluated in the user's session leading up to this event."
        )}
        isHelpHoverable
        title={t('Feature Flags')}
        type={SectionKey.FEATURE_FLAGS}
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

const SuspectLabel = styled('div')`
  color: ${p => p.theme.subText};
`;

const ValueWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
`;
