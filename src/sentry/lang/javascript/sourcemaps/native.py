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

from bisect import bisect_right

from collections import namedtuple
from six import text_type
from six.moves.urllib.parse import urljoin

from sentry.utils import json


Token = namedtuple('Token', ['dst_line', 'dst_col', 'src', 'src_line', 'src_col', 'src_id', 'name'])
SourceMapIndex = namedtuple('SourceMapIndex', ['tokens', 'keys', 'sources', 'content'])
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
    names = smap.get('names', [])
    mappings = smap['mappings']
    lines = mappings.split(';')
    sourceRoot = smap.get('sourceRoot')

    # turn /foo/bar into /foo/bar/ so urljoin doesnt strip the last path
    if sourceRoot:
        if not sourceRoot[-1:] == '/':
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

            # Must be either 4 or 5 long
            assert len(parse) in (4, 5)

            dst_col += parse[0]

            src_id += parse[1]
            src = sources[src_id]
            src_line += parse[2]
            src_col += parse[3]

            if len(parse) == 5:
                name_id += parse[4]
                name = names[name_id]
            else:
                name = None

            assert dst_line >= 0
            assert dst_col >= 0
            assert src_line >= 0
            assert src_col >= 0

            yield Token(dst_line, dst_col, src, src_line, src_col, src_id, name)


def _sourcemap_to_index(smap):
    token_list = []
    key_list = []
    content = {}
    sourceRoot = smap.get('sourceRoot')

    # turn /foo/bar into /foo/bar/ so urljoin doesnt strip the last path
    if sourceRoot:
        if not sourceRoot[-1:] == '/':
            sourceRoot = sourceRoot + '/'

        smap['sources'] = [
            urljoin(sourceRoot, src)
            for src in smap['sources']
        ]

        # Pop off the sourceRoot key to prevent applying this again
        # inside parse_sourcemap
        smap.pop('sourceRoot')

    if smap.get('sourcesContent'):
        for src_id, source in enumerate(smap['sources']):
            # Ensure we handle null files that may be specified outside of
            # sourcesContent
            try:
                value = smap['sourcesContent'][src_id]
            except IndexError:
                continue

            if value is None:
                continue

            content[src_id] = value

    for token in parse_sourcemap(smap):
        token_list.append(token)
        key_list.append((token.dst_line, token.dst_col))

    return SourceMapIndex(token_list, key_list, smap['sources'], content)


class View(object):
    def __init__(self, index):
        self.index = index

    @staticmethod
    def from_json(sourcemap):
        """
        Converts a raw sourcemap string to either a SourceMapIndex (basic source map)
        or IndexedSourceMapIndex (indexed source map w/ "sections")
        """
        if isinstance(sourcemap, text_type):
            sourcemap = sourcemap.encode('utf-8')
        smap = json.loads(sourcemap)

        if smap.get('sections'):
            # indexed source map
            offsets = []
            maps = []
            for section in smap.get('sections'):
                offset = section.get('offset')

                offsets.append((offset.get('line'), offset.get('column')))
                maps.append(_sourcemap_to_index(section.get('map')))
        else:
            # standard source map
            offsets = [(0, 0)]
            maps = [_sourcemap_to_index(smap)]

        return View(IndexedSourceMapIndex(offsets, maps))

    def iter_sources(self):
        for map_id, smap in enumerate(self.index.maps):
            for src_id, source in enumerate(smap.sources):
                yield (map_id, src_id), source

    def get_source_contents(self, (map_id, src_id)):
        try:
            return self.index.maps[map_id].content[src_id]
        except LookupError:
            return None

    def lookup_token(self, lineno, colno):
        """
        Given a SourceMapIndex and a transformed lineno/colno position,
        return the SourceMap object (which contains original file, line,
        column, and token name)
        """
        if lineno < 0 or colno < 0:
            return None

        smap_index = self.index

        # Optimize for the case where we only have 1 map which is
        # most common.
        if len(smap_index.maps) == 1:
            smap = smap_index.maps[0]
            line_offset = 0
            col_offset = 0
        else:
            map_index = bisect_right(smap_index.offsets, (lineno, colno)) - 1
            offset = smap_index.offsets[map_index]
            smap = smap_index.maps[map_index]
            line_offset = offset[0]
            col_offset = 0 if lineno != offset[0] else offset[1]
            lineno -= line_offset
            colno -= col_offset

        token = smap.tokens[bisect_right(smap.keys, (lineno, colno)) - 1]
        return Token(
            token.dst_line + line_offset,
            token.dst_col + col_offset,
            token.src,
            token.src_line,
            token.src_col,
            token.src_id,
            token.name,
        )


# For API Compatibility with libsourcemap
from_json = View.from_json
