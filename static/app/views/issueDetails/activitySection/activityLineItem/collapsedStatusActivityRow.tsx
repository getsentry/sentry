import {Fragment, type ReactNode, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tn} from 'sentry/locale';
import {ActivityLineDotMarker} from 'sentry/views/issueDetails/activitySection/activityLineItem/marker';
import {Timeline} from 'sentry/views/issueDetails/activitySection/timeline';

interface CollapsedStatusActivityRowProps {
  children: ReactNode;
  eventCount: number;
}

interface StatusActivityToggleRowProps {
  label: ReactNode;
  onClick: () => void;
}

export function CollapsedStatusActivityRow({
  children,
  eventCount,
}: CollapsedStatusActivityRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isExpanded) {
    return (
      <StatusActivityToggleRow
        label={t('Show %s more', eventCount)}
        onClick={() => setIsExpanded(true)}
      />
    );
  }

  return (
    <Fragment>
      {children}
      <StatusActivityToggleRow
        label={tn('Hide %s event', 'Hide %s events', eventCount)}
        onClick={() => setIsExpanded(false)}
      />
    </Fragment>
  );
}

function StatusActivityToggleRow({label, onClick}: StatusActivityToggleRowProps) {
  return (
    <Timeline.Item
      marker={<ActivityLineDotMarker />}
      headline={
        <Flex minHeight="22px" align="baseline" position="relative" bottom="2px">
          <Button
            variant="transparent"
            size="zero"
            style={{marginLeft: -6}}
            onClick={onClick}
          >
            <Text as="span" variant="muted" size="md" density="comfortable">
              {label}
            </Text>
          </Button>
        </Flex>
      }
    />
  );
}
