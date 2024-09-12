import {useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {FeatureFlagDrawer} from 'sentry/components/events/featureFlags/featureFlagDrawer';
import useDrawer from 'sentry/components/globalDrawer';
import KeyValueData, {
  type KeyValueDataContentProps,
} from 'sentry/components/keyValueData';
import {IconChevron, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, FeatureFlag} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';

export enum FlagSort {
  EVAL = 'eval',
  ALPHA = 'alphabetical',
}

export const getLabel = (sort: string) => {
  return sort === FlagSort.EVAL ? t('Evaluation Order') : t('Alphabetical');
};

export const FLAG_SORT_OPTIONS = [
  {
    label: getLabel(FlagSort.EVAL),
    value: FlagSort.EVAL,
  },
  {
    label: getLabel(FlagSort.ALPHA),
    value: FlagSort.ALPHA,
  },
];

export function EventFeatureFlagList({
  event,
  group,
  project,
}: {
  event: Event;
  group: Group;
  project: Project;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sortMethod, setSortMethod] = useState<FlagSort>(FlagSort.EVAL);
  const {closeDrawer, isDrawerOpen, openDrawer} = useDrawer();
  const viewAllButtonRef = useRef<HTMLButtonElement>(null);

  // transform the flags array into something readable by the key-value component
  const hydrateFlags = (flags: FeatureFlag[]) => {
    return flags.map(f => {
      return {item: {key: f.flag, subject: f.flag, value: f.result}};
    });
  };

  // TODO: remove this chunk --
  const organization = useOrganization();
  const flagsMap = organization.features.map(f => {
    return {flag: f, result: true};
  });
  const initialFlags = hydrateFlags(flagsMap);
  //----------------------------

  // const initialFlags = hydrateFlags(event.contexts?.flags.values);
  const [flags, setFlags] = useState<KeyValueDataContentProps[]>(initialFlags);

  const handleSortEval = () => {
    setFlags(initialFlags);
  };

  const handleSortAlphabetical = () => {
    setFlags(
      flags.sort((a, b) => {
        return a.item.key.localeCompare(b.item.key);
      })
    );
  };

  const onViewAllFlags = useCallback(() => {
    // good spot to track analytics
    openDrawer(
      () => (
        <FeatureFlagDrawer
          group={group}
          event={event}
          project={project}
          featureFlags={flags}
          initialFlags={initialFlags}
          sort={sortMethod}
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
  }, [openDrawer, flags, event, group, project, sortMethod, initialFlags]);

  if (!flags || !flags.length) {
    return null;
  }

  const actions = (
    <ButtonBar gap={1}>
      <Button
        size="xs"
        aria-label={t('View All')}
        ref={viewAllButtonRef}
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
          // good spot to track analytics
          setSortMethod(selection.value);
          selection.value === FlagSort.EVAL ? handleSortEval() : handleSortAlphabetical();
        }}
        trigger={triggerProps => (
          <DropdownButton {...triggerProps} size="xs" icon={<IconSort />}>
            {getLabel(sortMethod)}
          </DropdownButton>
        )}
      />
      <Button
        size="xs"
        icon={<IconChevron direction={isCollapsed ? 'down' : 'up'} />}
        aria-label={t('Collapse Section')}
        onClick={() => {
          // good spot to track analytics
          setIsCollapsed(!isCollapsed);
        }}
        borderless
      />
    </ButtonBar>
  );

  const truncatedItems = flags.slice(0, 20);
  const columnOne = truncatedItems.slice(0, 10);
  let columnTwo: any[] = [];
  if (truncatedItems.length > 10) {
    columnTwo = truncatedItems.slice(10, 20);
  }

  return (
    <ErrorBoundary mini message={t('There was a problem loading event tags.')}>
      <EventDataSection title={t('Feature Flags')} type="feature-flags" actions={actions}>
        {!isCollapsed && (
          <CardContainer>
            <KeyValueData.Card contentItems={columnOne} />
            <KeyValueData.Card contentItems={columnTwo} />
          </CardContainer>
        )}
      </EventDataSection>
    </ErrorBoundary>
  );
}

export const CardContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: start;

  div {
    border: none;
    border-radius: 0;
  }

  > * {
    :not(:first-child) {
      border-left: 1.5px solid ${p => p.theme.innerBorder};
      padding-left: ${space(2)};
      margin-left: -1px;
    }
    :not(:last-child) {
      border-right: 1.5px solid ${p => p.theme.innerBorder};
      padding-right: ${space(2)};
    }
  }
`;
