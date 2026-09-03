import {DiffFileType, DiffLineType} from 'sentry/components/events/autofix/types';

import {parseFilePatch} from './filePatch';

describe('parseFilePatch', () => {
  it('parses a modified patch into hunks with line numbers', () => {
    const patch = ['@@ -1,3 +1,4 @@ def foo():', ' a', '-b', '+c', '+d', ' e'].join('\n');

    const result = parseFilePatch({
      path: 'src/foo.py',
      patch,
      additions: 2,
      deletions: 1,
      changeType: 'MODIFIED',
    });

    expect(result.type).toBe(DiffFileType.MODIFIED);
    expect(result.path).toBe('src/foo.py');
    expect(result.source_file).toBe('src/foo.py');
    expect(result.target_file).toBe('src/foo.py');
    expect(result.added).toBe(2);
    expect(result.removed).toBe(1);
    expect(result.hunks).toHaveLength(1);

    const hunk = result.hunks[0]!;
    expect(hunk.source_start).toBe(1);
    expect(hunk.source_length).toBe(3);
    expect(hunk.target_start).toBe(1);
    expect(hunk.target_length).toBe(4);
    expect(hunk.section_header).toBe('def foo():');
    expect(hunk.lines).toEqual([
      {
        line_type: DiffLineType.CONTEXT,
        value: 'a',
        source_line_no: 1,
        target_line_no: 1,
        diff_line_no: 1,
      },
      {
        line_type: DiffLineType.REMOVED,
        value: 'b',
        source_line_no: 2,
        target_line_no: null,
        diff_line_no: 2,
      },
      {
        line_type: DiffLineType.ADDED,
        value: 'c',
        source_line_no: null,
        target_line_no: 2,
        diff_line_no: 3,
      },
      {
        line_type: DiffLineType.ADDED,
        value: 'd',
        source_line_no: null,
        target_line_no: 3,
        diff_line_no: 4,
      },
      {
        line_type: DiffLineType.CONTEXT,
        value: 'e',
        source_line_no: 3,
        target_line_no: 4,
        diff_line_no: 5,
      },
    ]);
  });

  it('maps changeType to DiffFileType', () => {
    const base = {path: 'f', patch: '', additions: 0, deletions: 0};
    expect(parseFilePatch({...base, changeType: 'ADDED'}).type).toBe(DiffFileType.ADDED);
    expect(parseFilePatch({...base, changeType: 'DELETED'}).type).toBe(
      DiffFileType.DELETED
    );
    expect(parseFilePatch({...base, changeType: 'RENAMED'}).type).toBe(
      DiffFileType.MODIFIED
    );
    expect(parseFilePatch({...base, changeType: null}).type).toBe(DiffFileType.MODIFIED);
  });

  it('parses multiple hunks', () => {
    const patch = ['@@ -1 +1 @@', '-a', '+b', '@@ -10,2 +10,2 @@', ' c', '-d', '+e'].join(
      '\n'
    );

    const result = parseFilePatch({
      path: 'f',
      patch,
      additions: 2,
      deletions: 2,
      changeType: 'MODIFIED',
    });

    expect(result.hunks).toHaveLength(2);
    expect(result.hunks[0]!.source_length).toBe(1);
    expect(result.hunks[1]!.source_start).toBe(10);
    expect(result.hunks[1]!.lines[0]!.source_line_no).toBe(10);
  });

  it('returns empty hunks for a null or empty patch', () => {
    expect(
      parseFilePatch({
        path: 'f',
        patch: null,
        additions: 0,
        deletions: 0,
        changeType: null,
      }).hunks
    ).toEqual([]);
    expect(
      parseFilePatch({path: 'f', patch: '', additions: 0, deletions: 0, changeType: null})
        .hunks
    ).toEqual([]);
  });

  it('ignores no-newline markers', () => {
    const patch = ['@@ -1 +1 @@', '-a', '\\ No newline at end of file', '+b'].join('\n');

    const result = parseFilePatch({
      path: 'f',
      patch,
      additions: 1,
      deletions: 1,
      changeType: 'MODIFIED',
    });

    expect(result.hunks[0]!.lines.map(line => line.value)).toEqual(['a', 'b']);
  });
});
