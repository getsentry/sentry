import {Fragment, useEffect, useEffectEvent} from 'react';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {MAX_CROSS_EVENT_QUERIES} from 'sentry/views/explore/constants';
import {
  useQueryParamsCrossEvents,
  useSetQueryParamsCrossEvents,
} from 'sentry/views/explore/queryParams/context';
import type {CrossEvent} from 'sentry/views/explore/queryParams/crossEvent';
import {isCrossEventType} from 'sentry/views/explore/queryParams/crossEvent';
import {SpansTabCrossEventMetricsSearchBar} from 'sentry/views/explore/spans/crossEvents/crossEventMetricsSearchBar';
import {SpansTabCrossEventSearchBar} from 'sentry/views/explore/spans/crossEvents/crossEventSearchBar';
import {useCrossEventDatasetAvailability} from 'sentry/views/explore/spans/crossEvents/useCrossEventDatasetAvailability';
import {
  getCrossEventDatasetOptions,
  makeCrossEvent,
} from 'sentry/views/explore/spans/crossEvents/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';

const EMPTY_CROSS_EVENTS: CrossEvent[] = [];

export function SpansTabCrossEventSearchBars() {
  const organization = useOrganization();
  const crossEvents = useQueryParamsCrossEvents() ?? EMPTY_CROSS_EVENTS;
  const setCrossEvents = useSetQueryParamsCrossEvents();
  const crossEventDatasetAvailability = useCrossEventDatasetAvailability(organization);

  // Using an effect event here to make sure we're reading only the latest props and not
  // firing based off of the cross events changing
  const fireErrorToast = useEffectEvent(() => {
    if (crossEvents.length > MAX_CROSS_EVENT_QUERIES) {
      addErrorMessage(
        t(
          'You can add up to a maximum of %s cross event queries.',
          MAX_CROSS_EVENT_QUERIES
        )
      );
    }
  });

  useEffect(() => {
    fireErrorToast();
  }, []);

  useEffect(() => {
    const availableCrossEvents = crossEvents.filter(
      crossEvent => crossEventDatasetAvailability[crossEvent.type]
    );

    if (availableCrossEvents.length !== crossEvents.length) {
      setCrossEvents(availableCrossEvents);
    }
  }, [crossEventDatasetAvailability, crossEvents, setCrossEvents]);

  const visibleCrossEvents = crossEvents
    .map((crossEvent, index) => ({crossEvent, index}))
    .filter(({crossEvent}) => crossEventDatasetAvailability[crossEvent.type]);

  if (visibleCrossEvents.length === 0) {
    return null;
  }

  return visibleCrossEvents.map(({crossEvent, index}, visibleIndex) => {
    let traceItemType = TraceItemDataset.SPANS;
    if (crossEvent.type === 'logs') {
      traceItemType = TraceItemDataset.LOGS;
    } else if (crossEvent.type === 'metrics') {
      traceItemType = TraceItemDataset.TRACEMETRICS;
    }

    const maxCrossEventQueriesReached = visibleIndex >= MAX_CROSS_EVENT_QUERIES;

    return (
      <Fragment key={`${crossEvent.type}-${index}`}>
        <Container justifySelf="end" width={{sm: '100%', md: 'min-content'}}>
          {props => (
            <CompactSelect
              {...props}
              menuTitle={t('Dataset')}
              aria-label={t('Modify dataset to cross reference')}
              value={crossEvent.type}
              disabled={maxCrossEventQueriesReached}
              trigger={triggerProps => (
                <OverlayTrigger.Button {...triggerProps} {...props} prefix={t('with')} />
              )}
              options={getCrossEventDatasetOptions(crossEventDatasetAvailability)}
              onChange={({value: newValue}) => {
                if (!isCrossEventType(newValue)) return;

                trackAnalytics('trace.explorer.cross_event_changed', {
                  organization,
                  new_type: newValue,
                  old_type: crossEvent.type,
                });

                setCrossEvents(
                  crossEvents.map((c, i) => {
                    if (i === index) return makeCrossEvent(newValue);
                    return c;
                  })
                );
              }}
            />
          )}
        </Container>
        {maxCrossEventQueriesReached ? (
          <SearchQueryBuilderProvider
            filterKeys={{}}
            getTagValues={() => Promise.resolve([])}
            initialQuery=""
            searchSource="explore"
          >
            <TraceItemSearchQueryBuilder
              disabled
              itemType={traceItemType}
              initialQuery={crossEvent.query}
              booleanAttributes={{}}
              numberAttributes={{}}
              stringAttributes={{}}
              booleanSecondaryAliases={{}}
              numberSecondaryAliases={{}}
              stringSecondaryAliases={{}}
              searchSource="explore"
              getFilterTokenWarning={() => {}}
              supportedAggregates={[]}
              onSearch={() => {}}
              onChange={() => {
                return;
              }}
            />
          </SearchQueryBuilderProvider>
        ) : crossEvent.type === 'metrics' ? (
          <SpansTabCrossEventMetricsSearchBar
            index={index}
            query={crossEvent.query}
            metric={crossEvent.metric}
          />
        ) : (
          <SpansTabCrossEventSearchBar
            index={index}
            query={crossEvent.query}
            type={crossEvent.type}
          />
        )}
        <Button
          icon={<IconDelete />}
          aria-label={t('Remove cross event search for %s', crossEvent.type)}
          onClick={() => {
            // we add 1 here to the max because the current cross event is being removed
            if (crossEvents.length > MAX_CROSS_EVENT_QUERIES + 1) {
              addErrorMessage(
                t(
                  'You can add up to a maximum of %s cross event queries.',
                  MAX_CROSS_EVENT_QUERIES
                )
              );
            }
            trackAnalytics('trace.explorer.cross_event_removed', {
              organization,
              type: crossEvent.type,
            });
            setCrossEvents(crossEvents.filter((_, i) => i !== index));
          }}
        />
      </Fragment>
    );
  });
}
