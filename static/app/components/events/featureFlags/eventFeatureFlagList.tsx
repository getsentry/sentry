import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import KeyValueData from 'sentry/components/keyValueData';
import {IconChevron, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';

export function EventFeatureFlagList({}: {event: Event}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sortMethod, setSortMethod] = useState<'recent' | 'alphabetical'>('recent');
  // const flags = event.contexts?.flags;

  // TODO: remove
  const organization = useOrganization();
  const flags = organization.features.map(f => {
    return {flag: f, result: true};
  });

  const handleSortRecent = () => {
    setSortMethod('recent');
  };

  const handleSortAlphabetical = () => {
    setSortMethod('alphabetical');
  };

  const getLabel = (sort: string) => {
    return sort === 'recent' ? t('Recently Changed') : t('Alphabetical');
  };

  // TODO: open panel when view all clicked
  const actions = (
    <ButtonBar gap={1}>
      <Button size="xs" aria-label={t('View All')} onClick={() => {}}>
        {t('View All')}
      </Button>
      <DropdownMenu
        items={[
          {
            key: 'recent',
            label: t('Recently Changed'),
            onAction: handleSortRecent,
          },
          {
            key: 'alphabetical',
            label: t('Alphabetical'),
            onAction: handleSortAlphabetical,
          },
        ]}
        triggerProps={{
          'aria-label': t('Sort'),
          showChevron: false,
        }}
        onSelectionChange={selection => {
          setSortMethod(selection[0]);
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

  if (!flags || !flags.length) {
    return null;
  }

  const contentItems = flags.map(f => {
    return {item: {key: f.flag, subject: f.flag, value: f.result}};
  });

  const truncatedItems = contentItems.slice(0, 20);
  const columnOne = truncatedItems.slice(0, 10);
  let columnTwo: any[] = [];
  if (truncatedItems.length > 10) {
    columnTwo = truncatedItems.slice(10, 20);
  }

  // TODO: add border in middle
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
  }
`;
