import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconArrow, IconBranch, IconChevron, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';

import {AccentPathSegment} from './accentPathSegment';
import {AutomaticTag} from './automaticTag';
import {DEFAULT_BRANCH, normalizePathMapping} from './normalization';
import {PathMappingDeleteButton} from './pathMappingDeleteButton';
import type {PathMappingValue} from './type';
import {isExactWarning} from './warnings';
import type {PathMappingWarning} from './warnings';

const PATH_RATIO = 35;
const BRANCH_RATIO = 30;

const WarningContainer = styled(Container)`
  background: ${p => p.theme.tokens.background.transparent.warning.muted};
`;

interface PathMappingSummaryProps extends PathMappingValue {
  expanded: boolean;
  onExpandToggle: () => void;
  defaultBranch?: string;
  onDelete?: () => void;
  warning?: PathMappingWarning;
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
  defaultBranch,
  warning,
  automaticallyGenerated,
  hasCodeOwner,
}: PathMappingSummaryProps) {
  const {
    stackRoot: normalizedStackRoot,
    sourceRoot: normalizedSourceRoot,
    branch: branchName,
  } = normalizePathMapping(
    {stackRoot, sourceRoot, branch},
    defaultBranch ?? DEFAULT_BRANCH
  );

  const hasWarning = isExactWarning(warning);
  const Wrapper = hasWarning ? WarningContainer : Container;

  return (
    <Wrapper padding="md xl">
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

        {automaticallyGenerated && (
          <Container flexShrink={0}>
            <AutomaticTag />
          </Container>
        )}

        <Flex
          align="center"
          gap="xs"
          flex={`${BRANCH_RATIO} 0 0%`}
          minWidth={0}
          maxWidth="max-content"
        >
          <Container flexShrink={0}>{props => <IconBranch {...props} />}</Container>
          <InfoText title={branchName} mode="overflowOnly" variant="muted">
            {branchName}
          </InfoText>
        </Flex>

        <Flex align="center" gap="xs" flexShrink={0}>
          <Button
            size="zero"
            variant="transparent"
            icon={<IconChevron direction={expanded ? 'up' : 'down'} />}
            aria-label={expanded ? t('Collapse path mapping') : t('Expand path mapping')}
            onClick={onExpandToggle}
          />
          {onDelete && (
            <PathMappingDeleteButton hasCodeOwner={hasCodeOwner} onDelete={onDelete} />
          )}
        </Flex>
      </Flex>
    </Wrapper>
  );
}
