import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';

import {isRootTransaction} from '../../traceDetails/utils';
import {isTraceNode} from '../traceGuards';
import type {TraceTree} from '../traceModels/traceTree';

const CANDIDATE_TRACE_TITLE_OPS = ['pageload', 'navigation'];

type TraceTitle = {
  op: string;
  transaction?: string;
} | null;

interface TitleProps {
  traceSlug: string;
  tree: TraceTree;
}

export function Title({traceSlug, tree}: TitleProps) {
  const traceTitle: TraceTitle = useMemo(() => {
    const trace = tree.root.children[0];

    if (!trace) {
      return null;
    }

    if (!isTraceNode(trace)) {
      throw new TypeError('Not trace node');
    }

    let firstRootTransaction: TraceTitle = null;
    let candidateTransaction: TraceTitle = null;
    let firstTransaction: TraceTitle = null;

    for (const transaction of trace.value.transactions || []) {
      const title = {
        op: transaction['transaction.op'],
        transaction: transaction.transaction,
      };

      // If we find a root transaction, we can stop looking and use it for the title.
      if (!firstRootTransaction && isRootTransaction(transaction)) {
        firstRootTransaction = title;
        break;
      } else if (
        // If we haven't found a root transaction, but we found a candidate transaction
        // with an op that we care about, we can use it for the title. We keep looking for
        // a root.
        !candidateTransaction &&
        CANDIDATE_TRACE_TITLE_OPS.includes(transaction['transaction.op'])
      ) {
        candidateTransaction = title;
        continue;
      } else if (!firstTransaction) {
        // If we haven't found a root or candidate transaction, we can use the first transaction
        // in the trace for the title.
        firstTransaction = title;
      }
    }

    return firstRootTransaction ?? candidateTransaction ?? firstTransaction;
  }, [tree.root.children]);

  return (
    <div>
      <HeaderTitle>
        {traceTitle ? (
          traceTitle.transaction ? (
            <Fragment>
              <strong>{traceTitle.op} - </strong>
              {traceTitle.transaction}
            </Fragment>
          ) : (
            '\u2014'
          )
        ) : (
          <Tooltip
            title={tct(
              'Might be due to sampling, ad blockers, permissions or more.[break][link:Read the docs]',
              {
                break: <br />,
                link: (
                  <ExternalLink href="https://docs.sentry.io/concepts/key-terms/tracing/trace-view/#troubleshooting" />
                ),
              }
            )}
            showUnderline
            position="right"
            isHoverable
          >
            <strong>{t('Missing Trace Root')}</strong>
          </Tooltip>
        )}
      </HeaderTitle>
      <HeaderSubtitle>
        Trace ID: {traceSlug}
        <CopyToClipboardButton borderless size="zero" iconSize="xs" text={traceSlug} />
      </HeaderSubtitle>
    </div>
  );
}

const HeaderTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  ${p => p.theme.overflowEllipsis};
`;

const HeaderSubtitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
`;
