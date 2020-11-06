import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {objectIsEmpty} from 'app/utils';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

import ContextSummaryUser from './contextSummaryUser';
import ContextSummaryGeneric from './contextSummaryGeneric';
import ContextSummaryDevice from './contextSummaryDevice';
import ContextSummaryGPU from './contextSummaryGPU';
import ContextSummaryOS from './contextSummaryOS';
import filterContexts from './filterContexts';

const MIN_CONTEXTS = 3;
const MAX_CONTEXTS = 4;
const KNOWN_CONTEXTS = [
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
  },
  {keys: ['client_os', 'os'], Component: ContextSummaryOS},
  {keys: ['device'], Component: ContextSummaryDevice},
  {keys: ['gpu'], Component: ContextSummaryGPU},
];

class ContextSummary extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
  };

  render() {
    const evt = this.props.event;
    let contextCount = 0;

    // Add defined contexts in the declared order, until we reach the limit
    // defined by MAX_CONTEXTS.
    let contexts = KNOWN_CONTEXTS.filter((...args) => filterContexts(evt, ...args)).map(
      ({keys, Component, ...props}) => {
        if (contextCount >= MAX_CONTEXTS) {
          return null;
        }

        const [key, data] = keys
          .map(k => [k, evt.contexts[k] || evt[k]])
          .find(([_k, d]) => !objectIsEmpty(d)) || [null, null];

        if (!key) {
          return null;
        }

        contextCount += 1;
        return <Component key={key} data={data} {...props} />;
      }
    );

    // Bail out if all contexts are empty or only the user context is set
    if (contextCount === 0 || (contextCount === 1 && contexts[0])) {
      return null;
    }

    if (contextCount < MIN_CONTEXTS) {
      // Add contents in the declared order until we have at least MIN_CONTEXTS
      // contexts in our list.
      contexts = KNOWN_CONTEXTS.filter((...args) => filterContexts(evt, ...args)).map(
        ({keys, Component, ...props}, index) => {
          if (contexts[index]) {
            return contexts[index];
          }
          if (contextCount >= MIN_CONTEXTS) {
            return null;
          }
          contextCount += 1;
          return <Component key={keys[0]} data={{}} {...props} />;
        }
      );
    }

    return <Wrapper className="context-summary">{contexts}</Wrapper>;
  }
}

export default ContextSummary;

const Wrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.gray300};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, auto);
    grid-gap: ${space(4)};
    padding: 25px ${space(4)} 25px 40px;
  }
`;
