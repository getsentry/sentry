# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.lang.javascript.sourcemaps import (
    SourceMap, parse_vlq, parse_sourcemap, sourcemap_to_index, find_source, get_inline_content_sources
)
from sentry.testutils import TestCase

from sentry.utils import json


sourcemap = """{
    "version":3,
    "file":"file.min.js",
    "sources":["file1.js","file2.js"],
    "names":["add","a","b","multiply","divide","c","e","Raven","captureException"],
    "mappings":"AAAA,QAASA,KAAIC,EAAGC,GACf,YACA,OAAOD,GAAIC,ECFZ,QAASC,UAASF,EAAGC,GACpB,YACA,OAAOD,GAAIC,EAEZ,QAASE,QAAOH,EAAGC,GAClB,YACA,KACC,MAAOC,UAASH,IAAIC,EAAGC,GAAID,EAAGC,GAAKG,EAClC,MAAOC,GACRC,MAAMC,iBAAiBF",
    "sourceRoot": "foo"
}"""

indexed_sourcemap_example = json.dumps({
    'version': 3,
    'file': 'min.js',
    'sections': [
        {
            'offset': {
                'line': 0,
                'column': 0
            },
            'map': {
                'version': 3,
                'sources': [
                    "one.js"
                ],
                'sourcesContent': [
                    ' ONE.foo = function (bar) {\n' +
                    '   return baz(bar);\n' +
                    ' };',
                ],
                'names': [
                    "bar",
                    "baz"
                ],
                'mappings': "CAAC,IAAI,IAAM,SAAUA,GAClB,OAAOC,IAAID",
                'file': "min.js",
                'sourceRoot': "/the/root"
            }
        },
        {
            'offset': {
                'line': 1,
                'column': 0
            },
            'map': {
                'version': 3,
                'sources': [
                    "two.js"
                ],
                'sourcesContent': [
                    ' TWO.inc = function (n) {\n' +
                    '   return n + 1;\n' +
                    ' };'
                ],
                'names': [
                    "n"
                ],
                'mappings': "CAAC,IAAI,IAAM,SAAUA,GAClB,OAAOA",
                'file': "min.js",
                'sourceRoot': "/the/root"
            }
        }
    ]
})


class ParseVlqTest(TestCase):
    def test_simple(self):
        assert parse_vlq('gqjG') == [100000]
        assert parse_vlq('hqjG') == [-100000]
        assert parse_vlq('DFLx+BhqjG') == [-1, -2, -5, -1000, -100000]
        assert parse_vlq('CEKw+BgqjG') == [1, 2, 5, 1000, 100000]
        assert parse_vlq('/+Z') == [-13295]


class FindSourceTest(TestCase):
    def test_simple(self):
        indexed_sourcemap = sourcemap_to_index(sourcemap)

        result = find_source(indexed_sourcemap, 1, 56)
        assert result == SourceMap(dst_line=0, dst_col=50, src='foo/file2.js', src_line=0, src_col=9, name='multiply')

        # Start of minified file (exact match first line/col tuple)
        result = find_source(indexed_sourcemap, 1, 0)
        assert result == SourceMap(dst_line=0, dst_col=0, src='foo/file1.js', src_line=0, src_col=0, name=None)

        # Last character in mapping
        result = find_source(indexed_sourcemap, 1, 36)
        assert result == SourceMap(dst_line=0, dst_col=30, src='foo/file1.js', src_line=2, src_col=1, name=None)

        # First character in mapping (exact match line/col tuple)
        result = find_source(indexed_sourcemap, 1, 37)
        assert result == SourceMap(dst_line=0, dst_col=37, src='foo/file1.js', src_line=2, src_col=8, name='a')

        # End of minified file (character *beyond* last line/col tuple)
        result = find_source(indexed_sourcemap, 1, 192)
        assert result == SourceMap(dst_line=0, dst_col=191, src='foo/file2.js', src_line=9, src_col=25, name='e')


class GetInlineContentSourcesTest(TestCase):
    def test_no_inline(self):
        # basic sourcemap fixture has no inlined sources, so expect an empty list
        indexed_sourcemap = sourcemap_to_index(sourcemap)

        sources = get_inline_content_sources(indexed_sourcemap, 'https://example.com/static/')
        assert sources == []

    def test_indexed_inline(self):
        indexed_sourcemap = sourcemap_to_index(indexed_sourcemap_example)

        sources = get_inline_content_sources(indexed_sourcemap, 'https://example.com/static/')
        assert sources == [
            ('https://example.com/the/root/one.js', [' ONE.foo = function (bar) {', '   return baz(bar);', ' };']),
            ('https://example.com/the/root/two.js', [' TWO.inc = function (n) {', '   return n + 1;', ' };'])
        ]


class ParseSourcemapTest(TestCase):
    def test_basic(self):
        smap = json.loads(sourcemap)
        states = list(parse_sourcemap(smap))

        assert states == [
            SourceMap(dst_line=0, dst_col=0, src='foo/file1.js', src_line=0, src_col=0, name=None),
            SourceMap(dst_line=0, dst_col=8, src='foo/file1.js', src_line=0, src_col=9, name='add'),
            SourceMap(dst_line=0, dst_col=13, src='foo/file1.js', src_line=0, src_col=13, name='a'),
            SourceMap(dst_line=0, dst_col=15, src='foo/file1.js', src_line=0, src_col=16, name='b'),
            SourceMap(dst_line=0, dst_col=18, src='foo/file1.js', src_line=1, src_col=1, name=None),
            SourceMap(dst_line=0, dst_col=30, src='foo/file1.js', src_line=2, src_col=1, name=None),
            SourceMap(dst_line=0, dst_col=37, src='foo/file1.js', src_line=2, src_col=8, name='a'),
            SourceMap(dst_line=0, dst_col=40, src='foo/file1.js', src_line=2, src_col=12, name='b'),
            SourceMap(dst_line=0, dst_col=42, src='foo/file2.js', src_line=0, src_col=0, name=None),
            SourceMap(dst_line=0, dst_col=50, src='foo/file2.js', src_line=0, src_col=9, name='multiply'),
            SourceMap(dst_line=0, dst_col=60, src='foo/file2.js', src_line=0, src_col=18, name='a'),
            SourceMap(dst_line=0, dst_col=62, src='foo/file2.js', src_line=0, src_col=21, name='b'),
            SourceMap(dst_line=0, dst_col=65, src='foo/file2.js', src_line=1, src_col=1, name=None),
            SourceMap(dst_line=0, dst_col=77, src='foo/file2.js', src_line=2, src_col=1, name=None),
            SourceMap(dst_line=0, dst_col=84, src='foo/file2.js', src_line=2, src_col=8, name='a'),
            SourceMap(dst_line=0, dst_col=87, src='foo/file2.js', src_line=2, src_col=12, name='b'),
            SourceMap(dst_line=0, dst_col=89, src='foo/file2.js', src_line=4, src_col=0, name=None),
            SourceMap(dst_line=0, dst_col=97, src='foo/file2.js', src_line=4, src_col=9, name='divide'),
            SourceMap(dst_line=0, dst_col=105, src='foo/file2.js', src_line=4, src_col=16, name='a'),
            SourceMap(dst_line=0, dst_col=107, src='foo/file2.js', src_line=4, src_col=19, name='b'),
            SourceMap(dst_line=0, dst_col=110, src='foo/file2.js', src_line=5, src_col=1, name=None),
            SourceMap(dst_line=0, dst_col=122, src='foo/file2.js', src_line=6, src_col=1, name=None),
            SourceMap(dst_line=0, dst_col=127, src='foo/file2.js', src_line=7, src_col=2, name=None),
            SourceMap(dst_line=0, dst_col=133, src='foo/file2.js', src_line=7, src_col=9, name='multiply'),
            SourceMap(dst_line=0, dst_col=143, src='foo/file2.js', src_line=7, src_col=18, name='add'),
            SourceMap(dst_line=0, dst_col=147, src='foo/file2.js', src_line=7, src_col=22, name='a'),
            SourceMap(dst_line=0, dst_col=149, src='foo/file2.js', src_line=7, src_col=25, name='b'),
            SourceMap(dst_line=0, dst_col=152, src='foo/file2.js', src_line=7, src_col=29, name='a'),
            SourceMap(dst_line=0, dst_col=154, src='foo/file2.js', src_line=7, src_col=32, name='b'),
            SourceMap(dst_line=0, dst_col=157, src='foo/file2.js', src_line=7, src_col=37, name='c'),
            SourceMap(dst_line=0, dst_col=159, src='foo/file2.js', src_line=8, src_col=3, name=None),
            SourceMap(dst_line=0, dst_col=165, src='foo/file2.js', src_line=8, src_col=10, name='e'),
            SourceMap(dst_line=0, dst_col=168, src='foo/file2.js', src_line=9, src_col=2, name='Raven'),
            SourceMap(dst_line=0, dst_col=174, src='foo/file2.js', src_line=9, src_col=8, name='captureException'),
            SourceMap(dst_line=0, dst_col=191, src='foo/file2.js', src_line=9, src_col=25, name='e'),
        ]


class ParseIndexedSourcemapTest(TestCase):
    # Tests lookups that fall exactly on source map token boundaries
    # https://github.com/mozilla/source-map/blob/master/test/test-source-map-consumer.js#138
    def test_exact_mappings(self):
        indexed_sourcemap = sourcemap_to_index(indexed_sourcemap_example)

        # one.js
        assert find_source(indexed_sourcemap, 1, 1) == \
            SourceMap(dst_line=0, dst_col=1, src='/the/root/one.js', src_line=0, src_col=1, name=None)
        assert find_source(indexed_sourcemap, 1, 18) == \
            SourceMap(dst_line=0, dst_col=18, src='/the/root/one.js', src_line=0, src_col=21, name='bar')
        assert find_source(indexed_sourcemap, 1, 28) == \
            SourceMap(dst_line=0, dst_col=28, src='/the/root/one.js', src_line=1, src_col=10, name='baz')

        # two.js
        assert find_source(indexed_sourcemap, 2, 18) == \
            SourceMap(dst_line=1, dst_col=18, src='/the/root/two.js', src_line=0, src_col=21, name='n')
        assert find_source(indexed_sourcemap, 2, 21) == \
            SourceMap(dst_line=1, dst_col=21, src='/the/root/two.js', src_line=1, src_col=3, name=None)
        assert find_source(indexed_sourcemap, 2, 21) == \
            SourceMap(dst_line=1, dst_col=21, src='/the/root/two.js', src_line=1, src_col=3, name=None)

    # Tests lookups that fall inside source map token boundaries
    # https://github.com/mozilla/source-map/blob/master/test/test-source-map-consumer.js#181
    def test_fuzzy_mapping(self):
        indexed_sourcemap = sourcemap_to_index(indexed_sourcemap_example)

        # one.js
        assert find_source(indexed_sourcemap, 1, 20) == \
            SourceMap(dst_line=0, dst_col=18, src='/the/root/one.js', src_line=0, src_col=21, name='bar')
        assert find_source(indexed_sourcemap, 1, 30) == \
            SourceMap(dst_line=0, dst_col=28, src='/the/root/one.js', src_line=1, src_col=10, name='baz')
        assert find_source(indexed_sourcemap, 2, 12) == \
            SourceMap(dst_line=1, dst_col=9, src='/the/root/two.js', src_line=0, src_col=11, name=None)
