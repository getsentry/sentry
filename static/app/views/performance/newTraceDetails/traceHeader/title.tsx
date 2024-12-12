import {Fragment} from 'react';
import styled from '@emotion/styled';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';

import type {TraceTree} from '../traceModels/traceTree';

interface TitleProps {
  representativeTransaction: TraceTree.Transaction | null;
  traceSlug: string;
}

export function Title({traceSlug, representativeTransaction}: TitleProps) {
  const traceTitle = representativeTransaction
    ? {
        op: representativeTransaction['transaction.op'],
        transaction: representativeTransaction.transaction,
      }
    : null;

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
