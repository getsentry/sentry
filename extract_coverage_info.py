from __future__ import annotations

import collections
import contextlib
import json
import sqlite3

WORKDIR = '/home/runner/work/sentry/sentry/'
QUERY = '''\
SELECT DISTINCT
    file.path,
    SUBSTR(context.context, 0, INSTR(context.context, '::'))
FROM line_bits
INNER JOIN file ON line_bits.file_id = file.id
INNER JOIN context ON line_bits.context_id = context.id
WHERE context.context != ''
ORDER BY file.path, context.context
'''


def main() -> int:
    data = collections.defaultdict(set)
    with contextlib.closing(sqlite3.connect('.coverage')) as db:
        for filename, test_filename in db.execute(QUERY):
            filename = filename.removeprefix(WORKDIR)
            data[filename].add(test_filename)

    with open('out.json', 'w') as f:
        json.dump({k: sorted(v) for k, v in data.items()}, f)

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
