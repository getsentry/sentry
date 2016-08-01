"""
sentry.utils.sourcemaps
~~~~~~~~~~~~~~~~~~~~~~~

Originally based on https://github.com/martine/python-sourcemap

Sentry implements the Source Map Revision 3 protocol. Specification:
https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit

Sentry supports both "standard" source maps, and has partial support for "indexed" source
maps. Specifically, it supports indexed source maps with the "map" section property as
output by the React Native bundler. It does NOT support indexed source maps with the "url"
section property.

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import bisect

from collections import namedtuple
from six.moves.urllib.parse import urljoin

from sentry.utils import json


SourceMap = namedtuple('SourceMap', ['dst_line', 'dst_col', 'src', 'src_line', 'src_col', 'name'])
SourceMapIndex = namedtuple('SourceMapIndex', ['states', 'keys', 'sources', 'content'])
IndexedSourceMapIndex = namedtuple('IndexedSourceMapIndex', ['offsets', 'maps'])

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


def _sourcemap_to_index(smap):
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


def sourcemap_to_index(sourcemap):
    """
    Converts a raw sourcemap string to either a SourceMapIndex (basic source map)
    or IndexedSourceMapIndex (indexed source map w/ "sections")
    """
    smap = json.loads(sourcemap)

    if smap.get('sections'):
        # indexed source map
        offsets = []
        maps = []
        for section in smap.get('sections'):
            offset = section.get('offset')

            offsets.append((offset.get('line'), offset.get('column')))
            maps.append(_sourcemap_to_index(section.get('map')))

        return IndexedSourceMapIndex(offsets, maps)
    else:
        # standard source map
        return _sourcemap_to_index(smap)


def get_inline_content_sources(sourcemap_index, sourcemap_url):
    """
    Returns a list of tuples of (filename, content) for each inline
    content found in the given source map index. Note that `content`
    itself is a list of code lines.
    """
    out = []
    if isinstance(sourcemap_index, IndexedSourceMapIndex):
        for smap in sourcemap_index.maps:
            out += get_inline_content_sources(smap, sourcemap_url)
    else:
        for source in sourcemap_index.sources:
            next_filename = urljoin(sourcemap_url, source)
            if source in sourcemap_index.content:
                out.append((next_filename, sourcemap_index.content[source]))
    return out


def find_source(sourcemap_index, lineno, colno):
    """
    Given a SourceMapIndex and a transformed lineno/colno position,
    return the SourceMap object (which contains original file, line,
    column, and token name)
    """

    # error says "line no 1, column no 56"
    assert lineno > 0, 'line numbers are 1-indexed'

    if isinstance(sourcemap_index, IndexedSourceMapIndex):
        map_index = bisect.bisect_right(sourcemap_index.offsets, (lineno - 1, colno)) - 1
        offset = sourcemap_index.offsets[map_index]
        col_offset = 0 if lineno != offset[0] else offset[1]
        state = find_source(
            sourcemap_index.maps[map_index],
            lineno - offset[0],
            colno - col_offset,
        )
        return SourceMap(
            state.dst_line + offset[0],
            state.dst_col + col_offset,
            state.src,
            state.src_line,
            state.src_col,
            state.name
        )
    else:
        return sourcemap_index.states[bisect.bisect_right(sourcemap_index.keys, (lineno - 1, colno)) - 1]
