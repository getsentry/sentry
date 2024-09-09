import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import DropdownButton from 'sentry/components/dropdownButton';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import KeyValueData from 'sentry/components/keyValueData';
import {IconChevron, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import useOrganization from 'sentry/utils/useOrganization';

export function EventFeatureFlagList({_event}: {_event: Event}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  // const flags = event.contexts?.flags;

  // TODO: remove
  const organization = useOrganization();
  const flags = organization.features.map(f => {
    return {flag: f, result: true};
  });

  // TODO: add more sorting options here
  // TODO: open panel when view all clicked
  const actions = (
    <ButtonBar gap={1}>
      <Button size="xs" aria-label={'View All'} onClick={() => {}}>
        {t('View All')}
      </Button>
      <DropdownButton
        size="xs"
        icon={<IconSort />}
        aria-label={'Sort'}
        onChange={() => {}}
      >
        {t('Alphabetical')}
      </DropdownButton>
      <Button
        size="xs"
        icon={<IconChevron direction={isCollapsed ? 'down' : 'up'} />}
        aria-label={'Collapse Section'}
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

  // TODO: columns

  return (
    <ErrorBoundary mini message={t('There was a problem loading event tags.')}>
      <EventDataSection title="Feature Flags" type="feature-flags" actions={actions}>
        {!isCollapsed && (
          <CardContainer>
            <KeyValueData.Card contentItems={contentItems} />
          </CardContainer>
        )}
      </EventDataSection>
    </ErrorBoundary>
  );
}

export const CardContainer = styled('div')`
  div {
    border: none;
  }
`;
