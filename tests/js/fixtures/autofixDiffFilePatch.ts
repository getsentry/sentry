import {
  DiffFileType,
  DiffLineType,
  FilePatch,
} from 'sentry/components/events/autofix/types';

export function AutofixDiffFilePatch(params: Partial<FilePatch> = {}): FilePatch {
  return {
    added: 1,
    path: 'src/sentry/processing/backpressure/memory.py',
    removed: 1,
    source_file: 'src/sentry/processing/backpressure/memory.py',
    target_file: 'src/sentry/processing/backpressure/memory.py',
    type: DiffFileType.MODIFIED,
    hunks: [
      {
        lines: [
          {
            line_type: DiffLineType.CONTEXT,
            diff_line_no: 6,
            source_line_no: 47,
            target_line_no: 47,
            value: '    # or alternatively: `used_memory_rss`?\n',
          },
          {
            line_type: DiffLineType.CONTEXT,
            diff_line_no: 7,
            source_line_no: 48,
            target_line_no: 48,
            value: '    memory_used = info.get("used_memory", 0)\n',
          },
          {
            line_type: DiffLineType.CONTEXT,
            diff_line_no: 8,
            source_line_no: 49,
            target_line_no: 49,
            value: '    # `maxmemory` might be 0 in development\n',
          },
          {
            line_type: DiffLineType.REMOVED,
            diff_line_no: 9,
            source_line_no: 50,
            target_line_no: null,
            value:
              '    memory_available = info.get("maxmemory", 0) or info["total_system_memory"]\n',
          },
          {
            line_type: DiffLineType.ADDED,
            diff_line_no: 10,
            source_line_no: null,
            target_line_no: 50,
            value:
              '    memory_available = info.get("maxmemory", 0) or info.get("total_system_memory", 0)\n',
          },
          {
            line_type: DiffLineType.CONTEXT,
            diff_line_no: 11,
            source_line_no: 51,
            target_line_no: 51,
            value: '\n',
          },
          {
            line_type: DiffLineType.CONTEXT,
            diff_line_no: 12,
            source_line_no: 52,
            target_line_no: 52,
            value: '    return ServiceMemory(node_id, memory_used, memory_available)\n',
          },
          {
            line_type: DiffLineType.CONTEXT,
            diff_line_no: 13,
            source_line_no: 53,
            target_line_no: 53,
            value: '\n',
          },
        ],
        section_header:
          'def get_memory_usage(node_id: str, info: Mapping[str, Any]) -> ServiceMemory:',
        source_length: 7,
        source_start: 47,
        target_length: 7,
        target_start: 47,
      },
    ],
    ...params,
  };
}
