import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {IconArrow, IconBranch, IconChevron, IconDelete, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';

import {AccentPathSegment} from './accentPathSegment';
import {normalizedPathMappingSchema} from './normalization';
import type {PathMappingValue} from './type';
import type {PathMappingWarning} from './warnings';

const PATH_RATIO = 35;
const BRANCH_RATIO = 30;

const WarningContainer = styled(Container)`
  background: ${p => p.theme.tokens.background.transparent.warning.muted};
`;

interface PathMappingSummaryProps extends PathMappingValue {
  expanded: boolean;
  onDelete: () => void;
  onExpandToggle: () => void;
  warning?: PathMappingWarning | null;
}

function PathSegment({value}: {value: string}) {
  return (
    <Flex flex={`${PATH_RATIO} 0 0%`} minWidth={0} maxWidth="max-content">
      {value ? (
        <AccentPathSegment value={value} ellipsis />
      ) : (
        <Text monospace variant="muted">
          {t('empty')}
        </Text>
      )}
    </Flex>
  );
}

export function PathMappingSummary({
  branch,
  sourceRoot,
  stackRoot,
  expanded,
  onDelete,
  onExpandToggle,
  warning,
}: PathMappingSummaryProps) {
  const {
    stackRoot: normalizedStackRoot,
    sourceRoot: normalizedSourceRoot,
    branch: branchName,
  } = normalizedPathMappingSchema.parse({stackRoot, sourceRoot, branch});

  const hasWarning = warning?.type === 'exact';
  const Wrapper = hasWarning ? WarningContainer : Container;

  return (
    <Wrapper padding="md xl" border={hasWarning ? 'warning' : undefined}>
      <Flex align="center" gap="md" minWidth={0}>
        {hasWarning && (
          <Container flexShrink={0}>
            {props => (
              <IconWarning
                size="xs"
                variant="warning"
                aria-label={t('Warning')}
                {...props}
              />
            )}
          </Container>
        )}
        <PathSegment value={normalizedStackRoot} />
        <Container flexShrink={0}>
          {props => <IconArrow direction="right" size="xs" {...props} />}
        </Container>
        <PathSegment value={normalizedSourceRoot} />

        <Container flex="1 0 0%" />

        <Flex
          align="center"
          gap="xs"
          flex={`${BRANCH_RATIO} 0 0%`}
          minWidth={0}
          maxWidth="max-content"
        >
          <Container flexShrink={0}>{props => <IconBranch {...props} />}</Container>
          {/* eslint-disable-next-line @sentry/scraps/prefer-info-text -- InfoText has no showOnlyOnOverflow support */}
          <Tooltip title={branchName} showOnlyOnOverflow skipWrapper>
            <Text variant="muted" ellipsis>
              {branchName}
            </Text>
          </Tooltip>
        </Flex>

        <Flex align="center" gap="xs" flexShrink={0}>
          <Button
            size="zero"
            variant="transparent"
            icon={<IconChevron direction={expanded ? 'up' : 'down'} />}
            aria-label={expanded ? t('Collapse path mapping') : t('Expand path mapping')}
            onClick={onExpandToggle}
          />
          <Button
            size="zero"
            variant="transparent"
            icon={<IconDelete />}
            aria-label={t('Delete path mapping')}
            onClick={onDelete}
          />
        </Flex>
      </Flex>
    </Wrapper>
  );
}
