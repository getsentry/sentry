import {Fragment} from 'react';
import styled from '@emotion/styled';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';

import {TraceShape, type TraceTree} from '../traceModels/traceTree';

interface TitleProps {
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  traceSlug: string;
  tree: TraceTree;
}

export function Title({rootEventResults, traceSlug, tree}: TitleProps) {
  const title = rootEventResults.data?.title;
  const op = rootEventResults.data?.contexts.trace?.op;
  const hasRoot =
    ![TraceShape.EMPTY_TRACE, TraceShape.NO_ROOT, TraceShape.ONLY_ERRORS].includes(
      tree.shape
    ) || tree.eventsCount === 1;

  return (
    <div>
      <HeaderTitle>
        {hasRoot ? (
          op ? (
            <Fragment>
              <strong>{op} - </strong>
              {title}
            </Fragment>
          ) : (
            title ?? '\u2014'
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
