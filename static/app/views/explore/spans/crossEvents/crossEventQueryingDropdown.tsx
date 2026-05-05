import type {Key} from 'react';

import {Container} from '@sentry/scraps/layout';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {MAX_CROSS_EVENT_QUERIES} from 'sentry/views/explore/constants';
import {
  useQueryParamsCrossEvents,
  useSetQueryParamsCrossEvents,
} from 'sentry/views/explore/queryParams/context';
import {isCrossEventType} from 'sentry/views/explore/queryParams/crossEvent';
import {useCrossEventDatasetAvailability} from 'sentry/views/explore/spans/crossEvents/useCrossEventDatasetAvailability';
import {
  getCrossEventDropdownItems,
  makeCrossEvent,
} from 'sentry/views/explore/spans/crossEvents/utils';

export function CrossEventQueryingDropdown() {
  const organization = useOrganization();
  const crossEvents = useQueryParamsCrossEvents();
  const setCrossEvents = useSetQueryParamsCrossEvents();
  const crossEventDatasetAvailability = useCrossEventDatasetAvailability(organization);

  const onAction = (key: Key) => {
    if (typeof key !== 'string' || !isCrossEventType(key)) {
      return;
    }

    trackAnalytics('trace.explorer.cross_event_added', {
      organization,
      type: key,
    });

    if (!crossEvents || crossEvents.length === 0) {
      setCrossEvents([makeCrossEvent(key)]);
    } else {
      setCrossEvents([...crossEvents, makeCrossEvent(key)]);
    }
  };

  const isDisabled =
    defined(crossEvents) && crossEvents.length >= MAX_CROSS_EVENT_QUERIES;
  const tooltipTitle = isDisabled
    ? t('Maximum of %s cross event queries allowed.', MAX_CROSS_EVENT_QUERIES)
    : t('For more targeted results, you can also cross reference other datasets.');

  return (
    <Container width="100%">
      {triggerProps => (
        <DropdownMenu
          onAction={onAction}
          items={getCrossEventDropdownItems(crossEventDatasetAvailability)}
          isDisabled={isDisabled}
          triggerProps={{
            ...triggerProps,
            tooltipProps: {title: tooltipTitle},
            size: 'md',
            showChevron: false,
            icon: <IconAdd />,
            'aria-label': t('Add a cross event query'),
          }}
        />
      )}
    </Container>
  );
}
