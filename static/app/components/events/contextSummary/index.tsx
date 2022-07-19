import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Event} from 'sentry/types/event';
import {objectIsEmpty} from 'sentry/utils';

import ContextSummaryDevice from './contextSummaryDevice';
import ContextSummaryGeneric from './contextSummaryGeneric';
import ContextSummaryGPU from './contextSummaryGPU';
import ContextSummaryOS from './contextSummaryOS';
import ContextSummaryUser from './contextSummaryUser';
import filterContexts from './filterContexts';

export type Context = {
  // TODO(ts): Refactor this component
  Component: (props: any) => JSX.Element;
  keys: string[];
  omitUnknownVersion?: boolean;
  unknownTitle?: string;
};

const MIN_CONTEXTS = 3;
const MAX_CONTEXTS = 4;
const KNOWN_CONTEXTS: Context[] = [
  {keys: ['user'], Component: ContextSummaryUser},
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
  {keys: ['client_os', 'os'], Component: ContextSummaryOS},
  {keys: ['device'], Component: ContextSummaryDevice},
  {keys: ['gpu'], Component: ContextSummaryGPU},
];

type Props = {
  event: Event;
};

function ContextSummary({event}: Props) {
  let contextCount = 0;

  // Add defined contexts in the declared order, until we reach the limit
  // defined by MAX_CONTEXTS.
  let contexts = KNOWN_CONTEXTS.filter(context => filterContexts(event, context)).map(
    ({keys, Component, unknownTitle, omitUnknownVersion}) => {
      if (contextCount >= MAX_CONTEXTS) {
        return null;
      }

      const [key, data] = keys
        .map(k => [k, event.contexts[k] || event[k]])
        .find(([_k, d]) => !objectIsEmpty(d)) || [null, null];

      if (!key) {
        return null;
      }

      contextCount += 1;
      return (
        <Component
          key={key}
          data={data}
          unknownTitle={unknownTitle}
          omitUnknownVersion={omitUnknownVersion}
        />
      );
    }
  );

  // Bail out if all contexts are empty or only the user context is set
  if (contextCount === 0 || (contextCount === 1 && contexts[0])) {
    return null;
  }

  if (contextCount < MIN_CONTEXTS) {
    // Add contents in the declared order until we have at least MIN_CONTEXTS
    // contexts in our list.
    contexts = KNOWN_CONTEXTS.filter(context => filterContexts(event, context)).map(
      ({keys, Component, unknownTitle}, index) => {
        if (contexts[index]) {
          return contexts[index];
        }
        if (contextCount >= MIN_CONTEXTS) {
          return null;
        }
        contextCount += 1;
        return <Component key={keys[0]} data={{}} unknownTitle={unknownTitle} />;
      }
    );
  }

  return <Wrapper className="context-summary">{contexts}</Wrapper>;
}

export default ContextSummary;

const Wrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    gap: ${space(3)};
    margin-bottom: ${space(2)};
  }
`;
