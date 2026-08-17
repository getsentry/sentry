import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {TagVariant} from 'sentry/utils/theme';

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
}: {
  additions: number;
  changeTag: FileChangeTag | null;
  children: ReactNode;
  deletions: number;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  path: string;
}) {
  return (
    <FileRow>
      <Disclosure size="sm" expanded={expanded} onExpandedChange={onExpandedChange}>
        <Disclosure.Title
          trailingItems={
            changeTag ? (
              <Tag variant={changeTag.variant}>{changeTag.label}</Tag>
            ) : undefined
          }
        >
          <Grid
            columns="minmax(60px, auto) minmax(0, 1fr)"
            gap="xl"
            align="center"
            width="100%"
          >
            <Flex gap="md" align="center">
              <Text size="sm" monospace variant="success">
                +{additions}
              </Text>
              <Text size="sm" monospace variant="danger">
                -{deletions}
              </Text>
            </Flex>
            <FilePath size="sm" monospace ellipsis title={path}>
              {path}
            </FilePath>
          </Grid>
        </Disclosure.Title>
        <Disclosure.Content>{children}</Disclosure.Content>
      </Disclosure>
    </FileRow>
  );
}

const FileRow = styled('div')`
  & + & {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

// Truncates the head of the path so the file name stays visible.
const FilePath = styled(Text)`
  direction: rtl;
  text-align: left;
`;
