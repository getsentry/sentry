# -*- coding: utf-8 -*-

from __future__ import absolute_import

from libsourcemap import from_json as view_from_json, Token
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


class FindSourceTest(TestCase):
    def test_simple(self):
        smap_view = view_from_json(sourcemap)

        result = smap_view.lookup_token(0, 56)
        assert result == Token(dst_line=0, dst_col=50, src='foo/file2.js', src_line=0, src_col=9, src_id=1, name='multiply')

        # Start of minified file (exact match first line/col tuple)
        result = smap_view.lookup_token(0, 0)
        assert result == Token(dst_line=0, dst_col=0, src='foo/file1.js', src_line=0, src_col=0, src_id=0, name=None)

        # Last character in mapping
        result = smap_view.lookup_token(0, 36)
        assert result == Token(dst_line=0, dst_col=30, src='foo/file1.js', src_line=2, src_col=1, src_id=0, name=None)

        # First character in mapping (exact match line/col tuple)
        result = smap_view.lookup_token(0, 37)
        assert result == Token(dst_line=0, dst_col=37, src='foo/file1.js', src_line=2, src_col=8, src_id=0, name='a')

        # End of minified file (character *beyond* last line/col tuple)
        result = smap_view.lookup_token(0, 192)
        assert result == Token(dst_line=0, dst_col=191, src='foo/file2.js', src_line=9, src_col=25, src_id=1, name='e')


class IterSourcesTest(TestCase):
    def test_basic(self):
        smap_view = view_from_json(sourcemap)
        assert list(smap_view.iter_sources()) == [
            (0, 'foo/file1.js'),
            (1, 'foo/file2.js'),
        ]


class GetSourceContentsTest(TestCase):
    def test_no_inline(self):
        # basic sourcemap fixture has no inlined sources, so expect None
        smap_view = view_from_json(sourcemap)

        source = smap_view.get_source_contents(0)
        assert source is None

    def test_indexed_inline(self):
        smap_view = view_from_json(indexed_sourcemap_example)

        assert smap_view.get_source_contents(0) == (
            ' ONE.foo = function (bar) {\n' +
            '   return baz(bar);\n' +
            ' };')
        assert smap_view.get_source_contents(1) == (
            ' TWO.inc = function (n) {\n' +
            '   return n + 1;\n' +
            ' };')


class ParseSourcemapTest(TestCase):
    def test_basic(self):
        index = view_from_json(sourcemap)

        assert list(index) == [
            Token(dst_line=0, dst_col=0, src='foo/file1.js', src_line=0, src_col=0, src_id=0, name=None),
            Token(dst_line=0, dst_col=8, src='foo/file1.js', src_line=0, src_col=9, src_id=0, name='add'),
            Token(dst_line=0, dst_col=13, src='foo/file1.js', src_line=0, src_col=13, src_id=0, name='a'),
            Token(dst_line=0, dst_col=15, src='foo/file1.js', src_line=0, src_col=16, src_id=0, name='b'),
            Token(dst_line=0, dst_col=18, src='foo/file1.js', src_line=1, src_col=1, src_id=0, name=None),
            Token(dst_line=0, dst_col=30, src='foo/file1.js', src_line=2, src_col=1, src_id=0, name=None),
            Token(dst_line=0, dst_col=37, src='foo/file1.js', src_line=2, src_col=8, src_id=0, name='a'),
            Token(dst_line=0, dst_col=40, src='foo/file1.js', src_line=2, src_col=12, src_id=0, name='b'),
            Token(dst_line=0, dst_col=42, src='foo/file2.js', src_line=0, src_col=0, src_id=1, name=None),
            Token(dst_line=0, dst_col=50, src='foo/file2.js', src_line=0, src_col=9, src_id=1, name='multiply'),
            Token(dst_line=0, dst_col=60, src='foo/file2.js', src_line=0, src_col=18, src_id=1, name='a'),
            Token(dst_line=0, dst_col=62, src='foo/file2.js', src_line=0, src_col=21, src_id=1, name='b'),
            Token(dst_line=0, dst_col=65, src='foo/file2.js', src_line=1, src_col=1, src_id=1, name=None),
            Token(dst_line=0, dst_col=77, src='foo/file2.js', src_line=2, src_col=1, src_id=1, name=None),
            Token(dst_line=0, dst_col=84, src='foo/file2.js', src_line=2, src_col=8, src_id=1, name='a'),
            Token(dst_line=0, dst_col=87, src='foo/file2.js', src_line=2, src_col=12, src_id=1, name='b'),
            Token(dst_line=0, dst_col=89, src='foo/file2.js', src_line=4, src_col=0, src_id=1, name=None),
            Token(dst_line=0, dst_col=97, src='foo/file2.js', src_line=4, src_col=9, src_id=1, name='divide'),
            Token(dst_line=0, dst_col=105, src='foo/file2.js', src_line=4, src_col=16, src_id=1, name='a'),
            Token(dst_line=0, dst_col=107, src='foo/file2.js', src_line=4, src_col=19, src_id=1, name='b'),
            Token(dst_line=0, dst_col=110, src='foo/file2.js', src_line=5, src_col=1, src_id=1, name=None),
            Token(dst_line=0, dst_col=122, src='foo/file2.js', src_line=6, src_col=1, src_id=1, name=None),
            Token(dst_line=0, dst_col=127, src='foo/file2.js', src_line=7, src_col=2, src_id=1, name=None),
            Token(dst_line=0, dst_col=133, src='foo/file2.js', src_line=7, src_col=9, src_id=1, name='multiply'),
            Token(dst_line=0, dst_col=143, src='foo/file2.js', src_line=7, src_col=18, src_id=1, name='add'),
            Token(dst_line=0, dst_col=147, src='foo/file2.js', src_line=7, src_col=22, src_id=1, name='a'),
            Token(dst_line=0, dst_col=149, src='foo/file2.js', src_line=7, src_col=25, src_id=1, name='b'),
            Token(dst_line=0, dst_col=152, src='foo/file2.js', src_line=7, src_col=29, src_id=1, name='a'),
            Token(dst_line=0, dst_col=154, src='foo/file2.js', src_line=7, src_col=32, src_id=1, name='b'),
            Token(dst_line=0, dst_col=157, src='foo/file2.js', src_line=7, src_col=37, src_id=1, name='c'),
            Token(dst_line=0, dst_col=159, src='foo/file2.js', src_line=8, src_col=3, src_id=1, name=None),
            Token(dst_line=0, dst_col=165, src='foo/file2.js', src_line=8, src_col=10, src_id=1, name='e'),
            Token(dst_line=0, dst_col=168, src='foo/file2.js', src_line=9, src_col=2, src_id=1, name='Raven'),
            Token(dst_line=0, dst_col=174, src='foo/file2.js', src_line=9, src_col=8, src_id=1, name='captureException'),
            Token(dst_line=0, dst_col=191, src='foo/file2.js', src_line=9, src_col=25, src_id=1, name='e'),
        ]


class ParseIndexedSourcemapTest(TestCase):
    # Tests lookups that fall exactly on source map token boundaries
    # https://github.com/mozilla/source-map/blob/master/test/test-source-map-consumer.js#138
    def test_exact_mappings(self):
        smap_view = view_from_json(indexed_sourcemap_example)

        # one.js
        assert smap_view.lookup_token(0, 1) == \
            Token(dst_line=0, dst_col=1, src='/the/root/one.js', src_line=0, src_col=1, src_id=0, name=None)
        assert smap_view.lookup_token(0, 18) == \
            Token(dst_line=0, dst_col=18, src='/the/root/one.js', src_line=0, src_col=21, src_id=0, name='bar')
        assert smap_view.lookup_token(0, 28) == \
            Token(dst_line=0, dst_col=28, src='/the/root/one.js', src_line=1, src_col=10, src_id=0, name='baz')

        # two.js
        assert smap_view.lookup_token(1, 18) == \
            Token(dst_line=1, dst_col=18, src='/the/root/two.js', src_line=0, src_col=21, src_id=1, name='n')
        assert smap_view.lookup_token(1, 21) == \
            Token(dst_line=1, dst_col=21, src='/the/root/two.js', src_line=1, src_col=3, src_id=1, name=None)
        assert smap_view.lookup_token(1, 21) == \
            Token(dst_line=1, dst_col=21, src='/the/root/two.js', src_line=1, src_col=3, src_id=1, name=None)

    # Tests lookups that fall inside source map token boundaries
    # https://github.com/mozilla/source-map/blob/master/test/test-source-map-consumer.js#181
    def test_fuzzy_mapping(self):
        smap_view = view_from_json(indexed_sourcemap_example)

        # one.js
        assert smap_view.lookup_token(0, 20) == \
            Token(dst_line=0, dst_col=18, src='/the/root/one.js', src_line=0, src_col=21, src_id=0, name='bar')
        assert smap_view.lookup_token(0, 30) == \
            Token(dst_line=0, dst_col=28, src='/the/root/one.js', src_line=1, src_col=10, src_id=0, name='baz')
        assert smap_view.lookup_token(1, 12) == \
            Token(dst_line=1, dst_col=9, src='/the/root/two.js', src_line=0, src_col=11, src_id=1, name=None)
