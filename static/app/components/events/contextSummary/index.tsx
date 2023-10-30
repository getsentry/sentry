import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event} from 'sentry/types/event';
import {objectIsEmpty} from 'sentry/utils';

import {ContextSummaryDevice} from './contextSummaryDevice';
import {ContextSummaryGeneric} from './contextSummaryGeneric';
import {ContextSummaryGPU} from './contextSummaryGPU';
import {ContextSummaryOS} from './contextSummaryOS';
import {ContextSummaryUser} from './contextSummaryUser';
import {Context} from './types';
import {makeContextFilter} from './utils';

const MIN_CONTEXTS = 3;
const MAX_CONTEXTS = 4;

const KNOWN_CONTEXTS: Context[] = [
  {
    keys: ['user'],
    Component: ContextSummaryUser,
  },
  {
    keys: ['browser'],
    Component: ContextSummaryGeneric,
    unknownTitle: t('Unknown Browser'),
  },
  {
    keys: ['runtime'],
    Component: ContextSummaryGeneric,
    unknownTitle: t('Unknown Runtime'),
    omitUnknownVersion: true,
  },
  {
    keys: ['client_os', 'os'],
    Component: ContextSummaryOS,
  },
  {
    keys: ['device'],
    Component: ContextSummaryDevice,
  },
  {
    keys: ['gpu'],
    Component: ContextSummaryGPU,
  },
];

type Props = {
  event: Event;
};

function ContextSummary({event}: Props) {
  const filteredContexts = KNOWN_CONTEXTS.filter(makeContextFilter(event));

  // XXX: We want to have *at least* MIN_CONTEXTS, so we first find all the
  // contexts that have data, if that doesn't complete our MIN_CONTEXTS, we add
  // in contextrs that have no data.

  const itemsWithData = filteredContexts
    .map(context => {
      // Find data for any of the keys
      const [key, data] = context.keys
        .map(k => [k, event.contexts[k] ?? event[k]] as const)
        .find(([_k, d]) => !objectIsEmpty(d)) ?? [null, null];

      // No context value? Skip it
      if (!key) {
        return null;
      }

      return {context, data, key};
    })
    .filter((items): items is NonNullable<typeof items> => !!items)
    .slice(0, MAX_CONTEXTS);

  // Don't render anything if we don't have any context
  if (itemsWithData.length === 0) {
    return null;
  }

  // Don't render anything if we only have the user context
  if (itemsWithData.length === 1) {
    return null;
  }

  // How many contexts without data do we need to add?
  const remaining = Math.max(0, MIN_CONTEXTS - itemsWithData.length);

  const itemsWithoutData = filteredContexts
    // Ignore context keys we already have data for
    .filter(context => !itemsWithData.some(({key}) => context.keys.includes(key)))
    .map(context => ({
      context,
      data: {} as any,
      key: context.keys[0],
    }))
    .slice(0, remaining);

  const contexts = [...itemsWithData, ...itemsWithoutData].map(({context, key, data}) => {
    const {Component, unknownTitle, omitUnknownVersion} = context;

    const props = {
      data,
      unknownTitle,
      omitUnknownVersion,
      meta: event._meta?.contexts?.[key] ?? {},
    };

    return <Component key={key} {...props} />;
  });

  return <Wrapper>{contexts}</Wrapper>;
}

export default ContextSummary;

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    gap: ${space(4)};
  }
`;
