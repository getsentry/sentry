import {useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import useDrawer from 'sentry/components/globalDrawer';
import KeyValueData, {
  type KeyValueDataContentProps,
} from 'sentry/components/keyValueData';
import {IconChevron, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, FeatureFlag} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';

export function EventFeatureFlagList({} /* event */ : {event: Event}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sortMethod, setSortMethod] = useState<'recent' | 'alphabetical'>('recent');
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

  // const initialFlags = hydrateFlags(event.contexts?.flags);
  const [flags, setFlags] = useState<KeyValueDataContentProps[]>(initialFlags);

  const handleSortRecent = () => {
    setFlags(initialFlags);
  };

  const handleSortAlphabetical = () => {
    setFlags(
      flags.sort((a, b) => {
        return a.item.key.localeCompare(b.item.key);
      })
    );
  };

  const getLabel = (sort: string) => {
    return sort === 'recent' ? t('Recently Changed') : t('Alphabetical');
  };

  const onViewAllFlags = useCallback(() => {
    // good spot to track analytics
    openDrawer(
      () => (
        <CardContainer>
          <KeyValueData.Card contentItems={flags} />
        </CardContainer>
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
  }, [openDrawer, flags]);

  if (!flags || !flags.length) {
    return null;
  }

  const actions = (
    <ButtonBar gap={1}>
      <Button
        size="xs"
        aria-label={t('View All')}
        ref={viewAllButtonRef}
        onClick={() => (isDrawerOpen ? closeDrawer() : onViewAllFlags())}
      >
        {t('View All')}
      </Button>
      <CompactSelect
        value={sortMethod}
        options={[
          {
            textValue: 'recent',
            label: t('Recently Changed'),
            value: 'recent',
          },
          {
            key: 'alphabetical',
            label: t('Alphabetical'),
            value: 'alphabetical',
          },
        ]}
        triggerProps={{
          'aria-label': t('Sort'),
          showChevron: false,
        }}
        onChange={selection => {
          setSortMethod(selection.value);
          selection.value === 'recent' ? handleSortRecent() : handleSortAlphabetical();
        }}
        trigger={triggerProps => (
          <DropdownButton
            {...triggerProps}
            size="xs"
            icon={<IconSort />}
            onChange={() => {}}
          >
            {getLabel(sortMethod)}
          </DropdownButton>
        )}
      />
      <Button
        size="xs"
        icon={<IconChevron direction={isCollapsed ? 'down' : 'up'} />}
        aria-label={t('Collapse Section')}
        onClick={() => setIsCollapsed(!isCollapsed)}
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

const CardContainer = styled('div')`
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
