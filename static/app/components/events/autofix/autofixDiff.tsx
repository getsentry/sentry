import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {type Change, diffWords} from 'diff';

import {Button} from 'sentry/components/button';
import {
  type DiffLine,
  DiffLineType,
  type FilePatch,
} from 'sentry/components/events/autofix/types';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type AutofixDiffProps = {
  diff: FilePatch[];
};

interface DiffLineWithChanges extends DiffLine {
  changes?: Change[];
}

function makeTestIdFromLineType(lineType: DiffLineType) {
  switch (lineType) {
    case DiffLineType.ADDED:
      return 'line-added';
    case DiffLineType.REMOVED:
      return 'line-removed';
    default:
      return 'line-context';
  }
}

function addChangesToDiffLines(lines: DiffLineWithChanges[]): DiffLineWithChanges[] {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.line_type === DiffLineType.CONTEXT) {
      continue;
    }

    if (line.line_type === DiffLineType.REMOVED) {
      const prevLine = lines[i - 1];
      const nextLine = lines[i + 1];
      const nextNextLine = lines[i + 2];

      if (
        nextLine?.line_type === DiffLineType.ADDED &&
        prevLine?.line_type !== DiffLineType.REMOVED &&
        nextNextLine?.line_type !== DiffLineType.ADDED
      ) {
        const changes = diffWords(line.value, nextLine.value);
        lines[i] = {...line, changes: changes.filter(change => !change.added)};
        lines[i + 1] = {...nextLine, changes: changes.filter(change => !change.removed)};
      }
    }
  }

  return lines;
}

function DiffLineCode({line}: {line: DiffLineWithChanges}) {
  if (!line.changes) {
    return <Fragment>{line.value}</Fragment>;
  }

  return (
    <Fragment>
      {line.changes.map((change, i) => (
        <CodeDiff key={i} added={change.added} removed={change.removed}>
          {change.value}
        </CodeDiff>
      ))}
    </Fragment>
  );
}

function HunkHeader({lines, sectionHeader}: {lines: DiffLine[]; sectionHeader: string}) {
  const {sourceStart, sourceLength, targetStart, targetLength} = useMemo(
    () => ({
      sourceStart: lines.at(0)?.source_line_no ?? 0,
      sourceLength: lines.filter(line => line.line_type !== DiffLineType.ADDED).length,
      targetStart: lines.at(0)?.target_line_no ?? 0,
      targetLength: lines.filter(line => line.line_type !== DiffLineType.REMOVED).length,
    }),
    [lines]
  );

  return (
    <HunkHeaderContent>{`@@ -${sourceStart},${sourceLength} +${targetStart},${targetLength} @@ ${sectionHeader ? ' ' + sectionHeader : ''}`}</HunkHeaderContent>
  );
}

function DiffHunkContent({lines, header}: {header: string; lines: DiffLine[]}) {
  const linesWithChanges = useMemo(() => {
    return addChangesToDiffLines(lines);
  }, [lines]);

  return (
    <Fragment>
      <HunkHeaderEmptySpace />
      <HunkHeader lines={lines} sectionHeader={header} />
      {linesWithChanges.map(line => (
        <Fragment key={line.diff_line_no}>
          <LineNumber lineType={line.line_type}>{line.source_line_no}</LineNumber>
          <LineNumber lineType={line.line_type}>{line.target_line_no}</LineNumber>
          <DiffContent
            lineType={line.line_type}
            data-test-id={makeTestIdFromLineType(line.line_type)}
          >
            <DiffLineCode line={line} />
          </DiffContent>
        </Fragment>
      ))}
    </Fragment>
  );
}

function FileDiff({file}: {file: FilePatch}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <FileDiffWrapper>
      <FileHeader onClick={() => setIsExpanded(value => !value)}>
        <InteractionStateLayer />
        <FileAddedRemoved>
          <FileAdded>+{file.added}</FileAdded>
          <FileRemoved>-{file.removed}</FileRemoved>
        </FileAddedRemoved>
        <FileName>{file.path}</FileName>
        <Button
          icon={<IconChevron size="xs" direction={isExpanded ? 'down' : 'right'} />}
          aria-label={t('Toggle file diff')}
          aria-expanded={isExpanded}
          size="zero"
          borderless
        />
      </FileHeader>
      {isExpanded && (
        <DiffContainer>
          {file.hunks.map(({section_header, source_start, lines}) => {
            return (
              <DiffHunkContent key={source_start} lines={lines} header={section_header} />
            );
          })}
        </DiffContainer>
      )}
    </FileDiffWrapper>
  );
}

export function AutofixDiff({diff}: AutofixDiffProps) {
  if (!diff || !diff.length) {
    return null;
  }

  return (
    <DiffsColumn>
      {diff.map(file => (
        <FileDiff key={file.path} file={file} />
      ))}
    </DiffsColumn>
  );
}

const DiffsColumn = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const FileDiffWrapper = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 20px;
  vertical-align: middle;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
`;

const FileHeader = styled('div')`
  position: relative;
  display: grid;
  align-items: center;
  grid-template-columns: minmax(60px, auto) 1fr auto;
  gap: ${space(2)};
  background-color: ${p => p.theme.backgroundSecondary};
  padding: ${space(1)} ${space(2)};
  cursor: pointer;
`;

const FileAddedRemoved = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const FileAdded = styled('div')`
  color: ${p => p.theme.successText};
`;

const FileRemoved = styled('div')`
  color: ${p => p.theme.errorText};
`;

const FileName = styled('div')``;

const DiffContainer = styled('div')`
  border-top: 1px solid ${p => p.theme.innerBorder};
  display: grid;
  grid-template-columns: auto auto 1fr;
`;

const HunkHeaderEmptySpace = styled('div')`
  grid-column: 1 / 3;
  background-color: ${p => p.theme.backgroundSecondary};
`;

const HunkHeaderContent = styled('div')`
  grid-column: 3 / -1;
  background-color: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};
  padding: ${space(0.75)} ${space(1)} ${space(0.75)} ${space(4)};
  white-space: pre-wrap;
`;

const LineNumber = styled('div')<{lineType: DiffLineType}>`
  display: flex;
  padding: ${space(0.25)} ${space(2)};
  user-select: none;

  background-color: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};

  ${p =>
    p.lineType === DiffLineType.ADDED &&
    `background-color: ${p.theme.diff.added}; color: ${p.theme.textColor}`};
  ${p =>
    p.lineType === DiffLineType.REMOVED &&
    `background-color: ${p.theme.diff.removed}; color: ${p.theme.textColor}`};

  & + & {
    padding-left: 0;
  }
`;

const DiffContent = styled('div')<{lineType: DiffLineType}>`
  position: relative;
  padding-left: ${space(4)};
  white-space: pre-wrap;

  ${p =>
    p.lineType === DiffLineType.ADDED &&
    `background-color: ${p.theme.diff.addedRow}; color: ${p.theme.textColor}`};
  ${p =>
    p.lineType === DiffLineType.REMOVED &&
    `background-color: ${p.theme.diff.removedRow}; color: ${p.theme.textColor}`};

  &::before {
    content: ${p =>
      p.lineType === DiffLineType.ADDED
        ? "'+'"
        : p.lineType === DiffLineType.REMOVED
          ? "'-'"
          : "''"};
    position: absolute;
    top: 1px;
    left: ${space(1)};
  }
`;

const CodeDiff = styled('span')<{added?: boolean; removed?: boolean}>`
  vertical-align: middle;
  ${p => p.added && `background-color: ${p.theme.diff.added};`};
  ${p => p.removed && `background-color: ${p.theme.diff.removed};`};
`;
