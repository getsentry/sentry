import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Panel} from 'sentry/components/panels/panel';
import {PanelItem} from 'sentry/components/panels/panelItem';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {HTTP_ERROR_STATUSES} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/constants';
import type {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';

type HttpErrorCardProps = {
  node: SpanNode | EapSpanNode;
};

function formatStatusText(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getStatusInfo(node: SpanNode | EapSpanNode): {
  statusCode: number | null;
  statusText: string | null;
} {
  const status =
    node instanceof SpanNode ? node.value.status : node.attributes?.['span.status'];
  const statusText =
    typeof status === 'string' && HTTP_ERROR_STATUSES.has(status)
      ? formatStatusText(status)
      : null;
  const raw = Number(node.attributes?.['http.response.status_code']);
  const statusCode = !isNaN(raw) && raw >= 400 ? raw : null;
  return {statusText, statusCode};
}

export function HttpErrorCard({node}: HttpErrorCardProps) {
  if (!node.hasHttpError) {
    return null;
  }

  const {statusText, statusCode} = getStatusInfo(node);

  return (
    <Wrapper>
      <StyledPanel>
        <StyledPanelItem>
          <Flex align="center" justify="center">
            <IconWarning size="md" variant="warning" />
          </Flex>
          <Stack gap="2xs">
            <Flex gap="xs" align="center">
              <Text bold>{statusText ?? t('HTTP Error')}</Text>
              {statusCode !== null && (
                <Text variant="muted">{t('HTTP %s', statusCode)}</Text>
              )}
            </Flex>
            <Text size="sm" variant="muted">
              {t('This span returned an error status but has no associated issue.')}
            </Text>
          </Stack>
        </StyledPanelItem>
      </StyledPanel>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  margin: ${p => p.theme.space.md} 0;
`;

const StyledPanel = styled(Panel)`
  margin-bottom: 0;
`;

const StyledPanelItem = styled(PanelItem)`
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl} ${p => p.theme.space.lg}
    ${p => p.theme.space.md};
`;
