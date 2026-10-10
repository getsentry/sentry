import {useId, type ReactNode} from 'react';
import styled from '@emotion/styled';
import {IconChevron} from '@sentry/icons/chevron';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {TagVariant} from 'sentry/utils/theme';
import {OpenFileButton} from 'sentry/views/seerExplorer/components/openFileButton';

export interface FileChangeTag {
  label: string;
  variant: TagVariant;
}

export function ChangedFileRow({
  additions,
  deletions,
  path,
  changeTag,
  expanded,
  onExpandedChange,
  children,
  fileUrl,
}: {
  additions: number;
  changeTag: FileChangeTag | null;
  children: ReactNode;
  deletions: number;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  path: string;
  fileUrl?: string | null;
}) {
  const contentId = useId();
  const toggle = () => onExpandedChange(!expanded);

  return (
    <FileRow data-test-id="changed-file-row">
      <TitleRow align="center" gap="sm" paddingRight="xs" onClick={toggle}>
        <ToggleButton
          size="sm"
          variant="transparent"
          icon={<IconChevron direction={expanded ? 'down' : 'right'} />}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={e => {
            e.stopPropagation();
            toggle();
          }}
        >
          <Container minWidth="0" flexShrink={1}>
            <FilePath size="sm" monospace variant="secondary" ellipsis title={path}>
              {path}
            </FilePath>
          </Container>
        </ToggleButton>
        <OpenFileButton fileUrl={fileUrl} />
        {changeTag ? <Tag variant={changeTag.variant}>{changeTag.label}</Tag> : null}
        <Flex flex="1" justify="end" gap="xs" align="center">
          <Text size="sm" monospace variant="success">
            +{additions}
          </Text>
          <Text size="sm" monospace variant="danger">
            -{deletions}
          </Text>
        </Flex>
      </TitleRow>
      <Container id={contentId} hidden={!expanded}>
        {children}
      </Container>
    </FileRow>
  );
}

const FileRow = styled(Container)`
  & + & {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

// Mirrors Disclosure.Title: the row, not the button, owns the hover/active background.
const TitleRow = styled(Flex)`
  cursor: pointer;

  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &:active {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
  }
`;

const ToggleButton = styled(Button)`
  min-width: 0;
  justify-content: flex-start;
  padding-left: ${p => p.theme.space.xs};

  &&:hover,
  &&:active {
    background-color: transparent;
  }
`;

// Truncates the head of the path so the file name stays visible.
const FilePath = styled(Text)`
  direction: rtl;
  text-align: left;
`;
