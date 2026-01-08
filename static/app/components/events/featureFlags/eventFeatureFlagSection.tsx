import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {
  CardContainer,
  EventFeatureFlagDrawer,
} from 'sentry/components/events/featureFlags/eventFeatureFlagDrawer';
import FeatureFlagSettingsButton from 'sentry/components/events/featureFlags/featureFlagSettingsButton';
import FeatureFlagSort from 'sentry/components/events/featureFlags/featureFlagSort';
import FlagActionDropdown from 'sentry/components/events/featureFlags/flagActionDropdown';
import {
  FlagControlOptions,
  ORDER_BY_OPTIONS,
  OrderBy,
  SORT_BY_OPTIONS,
  SortBy,
  sortedFlags,
} from 'sentry/components/events/featureFlags/utils';
import {useOrganizationFlagLog} from 'sentry/components/featureFlags/hooks/useOrganizationFlagLog';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import useDrawer from 'sentry/components/globalDrawer';
import {useGroupSuspectFlagScores} from 'sentry/components/issues/suspect/useGroupSuspectFlagScores';
import useLegacyEventSuspectFlags from 'sentry/components/issues/suspect/useLegacyEventSuspectFlags';
import useSuspectFlagScoreThreshold from 'sentry/components/issues/suspect/useSuspectFlagScoreThreshold';
import {KeyValueData} from 'sentry/components/keyValueData';
import {IconSearch} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Event, FeatureFlag} from 'sentry/types/event';
import {IssueCategory, type Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

export function EventFeatureFlagSection(props: EventFeatureFlagSectionProps) {
  return (
    <AnalyticsArea name="event_feature_flag_list">
      <BaseEventFeatureFlagList {...props} />
    </AnalyticsArea>
  );
}

type EventFeatureFlagSectionProps = {
  event: Event;
  group: Group;
  project: Project;
};

function BaseEventFeatureFlagList({event, group, project}: EventFeatureFlagSectionProps) {
  const organization = useOrganization();
  const environments = useEnvironmentsFromUrl();
  const theme = useTheme();
  const isXsScreen = useMedia(`(max-width: ${theme.breakpoints.xs})`);

  const feedbackButton = isXsScreen ? null : (
    <FeedbackButton
      aria-label={t('Give feedback on the feature flag section')}
      size="xs"
      feedbackOptions={{
        messagePlaceholder: t('How can we make feature flags work better for you?'),
        tags: {
          ['feedback.source']: 'issue_details_feature_flags',
          ['feedback.owner']: 'replay',
        },
      }}
    />
  );

  // If we're showing the suspect section at all
  const enableSuspectFlags = organization.features.includes('feature-flag-suspect-flags');

  const [sortBy, setSortBy] = useState<SortBy>(SortBy.EVAL_ORDER);
  const [orderBy, setOrderBy] = useState<OrderBy>(OrderBy.NEWEST);
  const {closeDrawer, isDrawerOpen, openDrawer} = useDrawer();
  const viewAllButtonRef = useRef<HTMLButtonElement>(null);

  const eventView = useIssueDetailsEventView({group});
  const {data: rawFlagData} = useOrganizationFlagLog({
    organization,
    query: {
      start: eventView.start,
      end: eventView.end,
      statsPeriod: eventView.statsPeriod,
    },
  });
  const location = useLocation();

  // issue list params we want to preserve in the search
  const queryParams = useMemo(
    () => ({
      start: eventView.start,
      end: eventView.end,
      statsPeriod: eventView.statsPeriod,
      project: eventView.project,
      environment: eventView.environment,
      sort: location.query.sort,
    }),
    [location.query, eventView]
  );

  const generateAction = useCallback(
    ({key, value}: {key: string; value: string}) => {
      const search = new MutableSearch('');
      const modifiedQuery = search.setFilterValues(key, [value]);

      return {
        pathname: `/organizations/${organization.slug}/issues/`,
        query: {
          ...queryParams,
          query: modifiedQuery.formatString(),
        },
      };
    },
    [organization, queryParams]
  );

  const {suspectFlags: legacySuspectFlags} = useLegacyEventSuspectFlags({
    enabled: !enableSuspectFlags, // Fallback to the legacy strategy
    organization,
    firstSeen: group.firstSeen,
    rawFlagData,
    event,
  });

  const [suspectThreshold] = useSuspectFlagScoreThreshold();
  const {data: suspectScores} = useGroupSuspectFlagScores({
    groupId: group.id,
    environment: environments.length ? environments : undefined,
    enabled: enableSuspectFlags,
  });

  const suspectFlagNames: Set<string> = useMemo(() => {
    if (enableSuspectFlags) {
      return new Set(
        suspectScores?.data
          .filter(score => score.score >= suspectThreshold)
          .map(score => score.flag)
      );
    }
    return new Set(legacySuspectFlags.map(f => f.flag));
  }, [enableSuspectFlags, legacySuspectFlags, suspectScores?.data, suspectThreshold]);

  const eventFlags: Array<Required<FeatureFlag>> = useMemo(() => {
    // At runtime there's no type guarantees on the event flags. So we have to
    // explicitly validate against SDK developer error or user-provided contexts.
    const rawFlags = event.contexts?.flags?.values ?? [];
    return rawFlags.filter(
      (f): f is Required<FeatureFlag> =>
        typeof f?.flag === 'string' && typeof f.result === 'boolean'
    );
  }, [event]);

  const hasFlags = eventFlags.length > 0;

  const hydratedFlags = useMemo(() => {
    // Transform the flags array into something readable by the key-value component.
    // Reverse the flags to show newest at the top by default.
    return eventFlags.toReversed().map(f => {
      return {
        item: {
          key: f.flag,
          subject: f.flag,
          value: (
            <ValueWrapper>
              {f.result.toString()}
              {suspectFlagNames.has(f.flag) && (
                <SuspectLabel>{t('Suspect')}</SuspectLabel>
              )}
              <FlagActionDropdown
                flag={f.flag}
                result={f.result.toString()}
                generateAction={generateAction}
              />
            </ValueWrapper>
          ),
        },
        isSuspectFlag: suspectFlagNames.has(f.flag),
      };
    });
  }, [suspectFlagNames, eventFlags, generateAction]);

  const onViewAllFlags = useCallback(
    (focusControl?: FlagControlOptions) => {
      trackAnalytics('flags.view-all-clicked', {
        organization,
      });
      openDrawer(
        () => (
          <EventFeatureFlagDrawer
            group={group}
            event={event}
            project={project}
            hydratedFlags={hydratedFlags}
            initialSortBy={sortBy}
            initialOrderBy={orderBy}
            focusControl={focusControl}
          />
        ),
        {
          ariaLabel: t('Feature flags drawer'),
          drawerKey: 'feature-flags-drawer',
          // We prevent a click on the 'View All' button from closing the drawer so that
          // we don't reopen it immediately, and instead let the button handle this itself.
          shouldCloseOnInteractOutside: element => {
            const viewAllButton = viewAllButtonRef.current;
            if (viewAllButton?.contains(element)) {
              return false;
            }
            return true;
          },
        }
      );
    },
    [openDrawer, event, group, project, hydratedFlags, organization, sortBy, orderBy]
  );

  useEffect(() => {
    if (hasFlags) {
      trackAnalytics('flags.table_rendered', {
        organization,
        numFlags: hydratedFlags.length,
        projectSlug: project.slug,
        orgSlug: organization.slug,
      });
    }
  }, [hasFlags, hydratedFlags.length, organization, project.slug]);

  if (group.issueCategory !== IssueCategory.ERROR) {
    return null;
  }

  // If the project has never ingested flags, hide the section entirely.
  if (!hasFlags && !project.hasFlags) {
    return null;
  }

  const actions = (
    <ButtonBar>
      {feedbackButton}
      <FeatureFlagSettingsButton orgSlug={organization.slug} />
      {hasFlags && (
        <Fragment>
          <Button
            aria-label={t('Open Feature Flag Search')}
            icon={<IconSearch size="xs" />}
            size="xs"
            title={t('Open Search')}
            onClick={() => onViewAllFlags(FlagControlOptions.SEARCH)}
          />
          <FeatureFlagSort
            sortByOptions={SORT_BY_OPTIONS}
            orderByOptions={ORDER_BY_OPTIONS}
            orderBy={orderBy}
            setOrderBy={value => {
              setOrderBy(value);
              trackAnalytics('flags.sort_flags', {
                organization,
                sortMethod: value as string,
              });
            }}
            setSortBy={value => {
              setSortBy(value);
              trackAnalytics('flags.sort_flags', {
                organization,
                sortMethod: value as string,
              });
            }}
            sortBy={sortBy}
          />
        </Fragment>
      )}
    </ButtonBar>
  );

  const NUM_PREVIEW_FLAGS = 20;

  // Split the flags list into columns for display
  const truncatedItems = sortedFlags({flags: hydratedFlags, sort: orderBy}).slice(
    0,
    NUM_PREVIEW_FLAGS
  );

  const shouldUseTwoColumns =
    !isXsScreen && truncatedItems.length > NUM_PREVIEW_FLAGS / 2;
  const columnOne = shouldUseTwoColumns
    ? truncatedItems.slice(0, NUM_PREVIEW_FLAGS / 2)
    : truncatedItems;
  const columnTwo = shouldUseTwoColumns
    ? truncatedItems.slice(NUM_PREVIEW_FLAGS / 2, NUM_PREVIEW_FLAGS)
    : [];

  const extraFlags = hydratedFlags.length - NUM_PREVIEW_FLAGS;
  const label = tn('View 1 More Flag', 'View %s More Flags', extraFlags);

  return (
    <InterimSection
      help={t(
        "The last 100 flags evaluated in the user's session leading up to this event."
      )}
      isHelpHoverable
      title={t('Feature Flags')}
      type={SectionKey.FEATURE_FLAGS}
      actions={actions}
    >
      {hasFlags ? (
        <CardContainer numCols={shouldUseTwoColumns ? 2 : 1}>
          <KeyValueData.Card expandLeft contentItems={columnOne} />
          <KeyValueData.Card expandLeft contentItems={columnTwo} />
        </CardContainer>
      ) : (
        <StyledEmptyStateWarning withIcon small>
          {t('No feature flags were found for this event')}
        </StyledEmptyStateWarning>
      )}
      {extraFlags > 0 && (
        <Button
          size="sm"
          // Since we've disabled the button as an 'outside click' for the drawer we can change
          // the operation based on the drawer state.
          onClick={() => (isDrawerOpen ? closeDrawer() : onViewAllFlags())}
          aria-label={label}
          ref={viewAllButtonRef}
        >
          {label}
        </Button>
      )}
    </InterimSection>
  );
}

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  border: ${p => p.theme.tokens.border.primary} solid 1px;
  border-radius: ${p => p.theme.radius.md};
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const SuspectLabel = styled('div')`
  color: ${p => p.theme.subText};
`;

const ValueWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr 0.5fr;
  justify-items: start;

  @media (max-width: ${p => p.theme.breakpoints.xs}) {
    grid-template-columns: 1fr 0.5fr;
    grid-template-rows: auto auto;

    /* Move suspect label to second row, spanning full width */
    ${SuspectLabel} {
      grid-column: 1 / -1;
      grid-row: 2;
    }
  }

  .invisible {
    visibility: hidden;
  }
  &:hover,
  &:active {
    .invisible .flag-button {
      visibility: visible;
    }
  }
`;
