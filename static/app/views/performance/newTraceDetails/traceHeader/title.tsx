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

interface TitleProps {
  traceSlug: string;
  tree: TraceTree;
}

export function Title({traceSlug, tree}: TitleProps) {
  const traceTitle: {
    op: string;
    transaction?: string;
  } | null = useMemo(() => {
    const trace = tree.root.children[0];

    if (!trace) {
      return null;
    }

    if (!isTraceNode(trace)) {
      throw new TypeError('Not trace node');
    }

    let firstRootTransaction: TraceTree.Title = null;
    let candidateTransaction: TraceTree.Title = null;
    let firstTransaction: TraceTree.Title = null;

    for (const transaction of trace.value.transactions || []) {
      const title = {
        op: transaction['transaction.op'],
        transaction: transaction.transaction,
      };

      if (!firstRootTransaction && isRootTransaction(transaction)) {
        firstRootTransaction = title;
        break;
      } else if (
        !candidateTransaction &&
        CANDIDATE_TRACE_TITLE_OPS.includes(transaction['transaction.op'])
      ) {
        candidateTransaction = title;
        continue;
      } else if (!firstTransaction) {
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
