import {
  DiffFileType,
  DiffLineType,
  isFilePatch,
  type FilePatch,
} from 'sentry/components/events/autofix/types';

function makeValidDiffLine(): FilePatch['hunks'][number]['lines'][number] {
  return {
    diff_line_no: 1,
    line_type: DiffLineType.ADDED,
    source_line_no: null,
    target_line_no: 1,
    value: '+console.log("hello")',
  };
}

function makeValidHunk(): FilePatch['hunks'][number] {
  return {
    lines: [makeValidDiffLine()],
    section_header: '@@ -1,3 +1,4 @@',
    source_length: 3,
    source_start: 1,
    target_length: 4,
    target_start: 1,
  };
}

function makeValidFilePatch(): FilePatch {
  return {
    added: 1,
    hunks: [makeValidHunk()],
    path: 'src/index.ts',
    removed: 0,
    source_file: 'a/src/index.ts',
    target_file: 'b/src/index.ts',
    type: DiffFileType.MODIFIED,
  };
}

describe('isFilePatch', () => {
  it('returns true for a valid FilePatch', () => {
    expect(isFilePatch(makeValidFilePatch())).toBe(true);
  });

  it('returns false for null and non-objects', () => {
    expect(isFilePatch(null)).toBe(false);
    expect(isFilePatch(undefined)).toBe(false);
    expect(isFilePatch('string')).toBe(false);
    expect(isFilePatch(42)).toBe(false);
  });

  it('returns false for objects missing required fields', () => {
    const {added: _, ...noAdded} = makeValidFilePatch();
    expect(isFilePatch(noAdded)).toBe(false);

    expect(isFilePatch({...makeValidFilePatch(), path: 123})).toBe(false);
  });

  it('returns false when type is not a valid DiffFileType', () => {
    expect(isFilePatch({...makeValidFilePatch(), type: 'X'})).toBe(false);
  });

  it('returns false when hunks contain invalid entries', () => {
    expect(
      isFilePatch({
        ...makeValidFilePatch(),
        hunks: [{lines: [], source_start: 1}],
      })
    ).toBe(false);
  });

  it('returns false when nested lines contain invalid DiffLine entries', () => {
    const badHunk = {
      ...makeValidHunk(),
      lines: [{diff_line_no: 1, line_type: 'INVALID', source_line_no: null}],
    };
    expect(isFilePatch({...makeValidFilePatch(), hunks: [badHunk]})).toBe(false);
  });

  it('returns true when hunks is an empty array', () => {
    expect(isFilePatch({...makeValidFilePatch(), hunks: []})).toBe(true);
  });
});
