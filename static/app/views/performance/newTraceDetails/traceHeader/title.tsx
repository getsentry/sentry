import styled from '@emotion/styled';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useProjects from 'sentry/utils/useProjects';

import {TraceShape, type TraceTree} from '../traceModels/traceTree';

interface TitleProps {
  representativeTransaction: TraceTree.Transaction | null;
  traceSlug: string;
  tree: TraceTree;
}

export function Title({tree, traceSlug, representativeTransaction}: TitleProps) {
  const traceTitle = representativeTransaction
    ? {
        op: representativeTransaction['transaction.op'],
        transaction: representativeTransaction.transaction,
      }
    : null;
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === representativeTransaction?.project_slug);

  return (
    <div>
      {traceTitle ? (
        traceTitle.transaction ? (
          <TitleWrapper>
            {project && (
              <ProjectBadge
                hideName
                project={project}
                avatarSize={20}
                avatarProps={{
                  hasTooltip: true,
                  tooltip: representativeTransaction?.project_slug,
                }}
              />
            )}
            <TitleText>
              <strong>{traceTitle.op} - </strong>
              {traceTitle.transaction}
            </TitleText>
          </TitleWrapper>
        ) : (
          '\u2014'
        )
      ) : (
        <TitleText>
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
            <strong>
              {tree.shape === TraceShape.ONLY_ERRORS
                ? t('Missing Trace Spans')
                : t('Missing Trace Root')}
            </strong>
          </Tooltip>
        </TitleText>
      )}
      <SubtitleText>
        Trace ID: {traceSlug}
        <CopyToClipboardButton borderless size="zero" iconSize="xs" text={traceSlug} />
      </SubtitleText>
    </div>
  );
}

const TitleWrapper = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
`;

const TitleText = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  ${p => p.theme.overflowEllipsis};
`;

const SubtitleText = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
`;
