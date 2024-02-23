import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {type Change, diffWords} from 'diff';

import {
  type AutofixResult,
  type DiffLine,
  DiffLineType,
} from 'sentry/components/events/autofix/types';
import {space} from 'sentry/styles/space';

type AutofixDiffProps = {
  fix: AutofixResult;
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

function DiffHunkContent({lines, header}: {header: string; lines: DiffLine[]}) {
  const linesWithChanges = useMemo(() => {
    return addChangesToDiffLines(lines);
  }, [lines]);

  return (
    <Fragment>
      <HunkHeaderEmptySpace />
      <HunkHeader>{header}</HunkHeader>
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

export function AutofixDiff({fix}: AutofixDiffProps) {
  if (!fix.diff) {
    return null;
  }

  return (
    <Fragment>
      {fix.diff.map((file, i) => (
        <FileDiffWrapper key={i}>
          <FileName>{file.path}</FileName>
          <DiffContainer>
            {file.hunks.map(({section_header, source_start, lines}) => {
              return (
                <DiffHunkContent
                  key={source_start}
                  lines={lines}
                  header={section_header}
                />
              );
            })}
          </DiffContainer>
        </FileDiffWrapper>
      ))}
    </Fragment>
  );
}

const FileDiffWrapper = styled('div')`
  margin: 0 -${space(2)};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 20px;
  vertical-align: middle;
`;

const FileName = styled('div')`
  padding: 0 ${space(2)} ${space(1)} ${space(2)};
`;

const DiffContainer = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  border-bottom: 1px solid ${p => p.theme.border};
  display: grid;
  grid-template-columns: auto auto 1fr;
`;

const HunkHeaderEmptySpace = styled('div')`
  grid-column: 1 / 3;
  background-color: ${p => p.theme.backgroundSecondary};
`;

const HunkHeader = styled('div')`
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
