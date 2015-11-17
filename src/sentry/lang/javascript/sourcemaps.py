"""
sentry.utils.sourcemaps
~~~~~~~~~~~~~~~~~~~~~~~

Originally based on https://github.com/martine/python-sourcemap

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import bisect

from collections import namedtuple
from urlparse import urljoin

from sentry.utils import json


SourceMap = namedtuple('SourceMap', ['dst_line', 'dst_col', 'src', 'src_line', 'src_col', 'name'])
SourceMapIndex = namedtuple('SourceMapIndex', ['states', 'keys', 'sources', 'content'])

# Mapping of base64 letter -> integer value.
B64 = dict(
    (c, i) for i, c in
    enumerate('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/')
)


def parse_vlq(segment):
    """
    Parse a string of VLQ-encoded data.

    Returns:
      a list of integers.
    """

    values = []

    cur, shift = 0, 0
    for c in segment:
        val = B64[c]
        # Each character is 6 bits:
        # 5 of value and the high bit is the continuation.
        val, cont = val & 0b11111, val >> 5
        cur += val << shift
        shift += 5

        if not cont:
            # The low bit of the unpacked value is the sign.
            cur, sign = cur >> 1, cur & 1
            if sign:
                cur = -cur
            values.append(cur)
            cur, shift = 0, 0

    if cur or shift:
        raise Exception('leftover cur/shift in vlq decode')

    return values


def parse_sourcemap(smap):
    """
    Given a sourcemap json object, yield SourceMap objects as they are read from it.
    """
    sources = smap['sources']
    sourceRoot = smap.get('sourceRoot')
    names = smap.get('names', [])
    mappings = smap['mappings']
    lines = mappings.split(';')

    if sourceRoot:
        # turn /foo/bar into /foo/bar/ so urljoin doesnt strip the last path
        if not sourceRoot.endswith('/'):
            sourceRoot = sourceRoot + '/'

        sources = [
            urljoin(sourceRoot, src)
            for src in sources
        ]

    dst_col, src_id, src_line, src_col, name_id = 0, 0, 0, 0, 0
    for dst_line, line in enumerate(lines):
        segments = line.split(',')
        dst_col = 0
        for segment in segments:
            if not segment:
                continue
            parse = parse_vlq(segment)
            dst_col += parse[0]

            src = None
            name = None
            if len(parse) > 1:
                src_id += parse[1]
                src = sources[src_id]
                src_line += parse[2]
                src_col += parse[3]

                if len(parse) > 4:
                    name_id += parse[4]
                    name = names[name_id]

            assert dst_line >= 0
            assert dst_col >= 0
            assert src_line >= 0
            assert src_col >= 0

            yield SourceMap(dst_line, dst_col, src, src_line, src_col, name)


def sourcemap_to_index(sourcemap):
    smap = json.loads(sourcemap)

    state_list = []
    key_list = []
    src_list = set()
    content = {}
    sourceRoot = smap.get('sourceRoot')

    # turn /foo/bar into /foo/bar/ so urljoin doesnt strip the last path
    if sourceRoot and not sourceRoot.endswith('/'):
        sourceRoot = sourceRoot + '/'

    if smap.get('sourcesContent'):
        for idx, source in enumerate(smap['sources']):
            # Ensure we handle null files that may be specified outside of
            # sourcesContent
            try:
                value = smap['sourcesContent'][idx]
            except IndexError:
                continue

            if value is None:
                continue

            # Apply the root to the source before shoving into the index
            # so we can look it up correctly later
            source = urljoin(sourceRoot, source)
            content[source] = value.split('\n')

    for state in parse_sourcemap(smap):
        state_list.append(state)
        key_list.append((state.dst_line, state.dst_col))

        # Apparently it's possible to not have a src
        # specified in the vlq segments
        if state.src is not None:
            src_list.add(state.src)

    return SourceMapIndex(state_list, key_list, src_list, content)


def find_source(indexed_sourcemap, lineno, colno):
    # error says "line no 1, column no 56"
    assert lineno > 0, 'line numbers are 1-indexed'
    return indexed_sourcemap.states[bisect.bisect_left(indexed_sourcemap.keys, (lineno - 1, colno)) - 1]
