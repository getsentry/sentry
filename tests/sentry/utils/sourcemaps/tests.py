# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.utils.sourcemaps import (SourceMap, parse_vlq, parse_sourcemap, sourcemap_to_index,
    find_source)
from sentry.testutils import TestCase

from sentry.utils import json


sourcemap = """{"version":3,"file":"file.min.js","sources":["file1.js","file2.js"],"names":["add","a","b","multiply","divide","c","e","Raven","captureException"],"mappings":"AAAA,QAASA,KAAIC,EAAGC,GACf,YACA,OAAOD,GAAIC,ECFZ,QAASC,UAASF,EAAGC,GACpB,YACA,OAAOD,GAAIC,EAEZ,QAASE,QAAOH,EAAGC,GAClB,YACA,KACC,MAAOC,UAASH,IAAIC,EAAGC,GAAID,EAAGC,GAAKG,EAClC,MAAOC,GACRC,MAAMC,iBAAiBF"}"""


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

        assert result == SourceMap(dst_line=0, dst_col=50, src='file2.js', src_line=0, src_col=9, name='multiply')


class ParseSourcemapTest(TestCase):
    def test_basic(self):
        smap = json.loads(sourcemap)
        states = list(parse_sourcemap(smap))

        assert states == [
            SourceMap(dst_line=0, dst_col=0, src='file1.js', src_line=0, src_col=0, name=None),
            SourceMap(dst_line=0, dst_col=8, src='file1.js', src_line=0, src_col=9, name='add'),
            SourceMap(dst_line=0, dst_col=13, src='file1.js', src_line=0, src_col=13, name='a'),
            SourceMap(dst_line=0, dst_col=15, src='file1.js', src_line=0, src_col=16, name='b'),
            SourceMap(dst_line=0, dst_col=18, src='file1.js', src_line=1, src_col=1, name=None),
            SourceMap(dst_line=0, dst_col=30, src='file1.js', src_line=2, src_col=1, name=None),
            SourceMap(dst_line=0, dst_col=37, src='file1.js', src_line=2, src_col=8, name='a'),
            SourceMap(dst_line=0, dst_col=40, src='file1.js', src_line=2, src_col=12, name='b'),
            SourceMap(dst_line=0, dst_col=42, src='file2.js', src_line=0, src_col=0, name=None),
            SourceMap(dst_line=0, dst_col=50, src='file2.js', src_line=0, src_col=9, name='multiply'),
            SourceMap(dst_line=0, dst_col=60, src='file2.js', src_line=0, src_col=18, name='a'),
            SourceMap(dst_line=0, dst_col=62, src='file2.js', src_line=0, src_col=21, name='b'),
            SourceMap(dst_line=0, dst_col=65, src='file2.js', src_line=1, src_col=1, name=None),
            SourceMap(dst_line=0, dst_col=77, src='file2.js', src_line=2, src_col=1, name=None),
            SourceMap(dst_line=0, dst_col=84, src='file2.js', src_line=2, src_col=8, name='a'),
            SourceMap(dst_line=0, dst_col=87, src='file2.js', src_line=2, src_col=12, name='b'),
            SourceMap(dst_line=0, dst_col=89, src='file2.js', src_line=4, src_col=0, name=None),
            SourceMap(dst_line=0, dst_col=97, src='file2.js', src_line=4, src_col=9, name='divide'),
            SourceMap(dst_line=0, dst_col=105, src='file2.js', src_line=4, src_col=16, name='a'),
            SourceMap(dst_line=0, dst_col=107, src='file2.js', src_line=4, src_col=19, name='b'),
            SourceMap(dst_line=0, dst_col=110, src='file2.js', src_line=5, src_col=1, name=None),
            SourceMap(dst_line=0, dst_col=122, src='file2.js', src_line=6, src_col=1, name=None),
            SourceMap(dst_line=0, dst_col=127, src='file2.js', src_line=7, src_col=2, name=None),
            SourceMap(dst_line=0, dst_col=133, src='file2.js', src_line=7, src_col=9, name='multiply'),
            SourceMap(dst_line=0, dst_col=143, src='file2.js', src_line=7, src_col=18, name='add'),
            SourceMap(dst_line=0, dst_col=147, src='file2.js', src_line=7, src_col=22, name='a'),
            SourceMap(dst_line=0, dst_col=149, src='file2.js', src_line=7, src_col=25, name='b'),
            SourceMap(dst_line=0, dst_col=152, src='file2.js', src_line=7, src_col=29, name='a'),
            SourceMap(dst_line=0, dst_col=154, src='file2.js', src_line=7, src_col=32, name='b'),
            SourceMap(dst_line=0, dst_col=157, src='file2.js', src_line=7, src_col=37, name='c'),
            SourceMap(dst_line=0, dst_col=159, src='file2.js', src_line=8, src_col=3, name=None),
            SourceMap(dst_line=0, dst_col=165, src='file2.js', src_line=8, src_col=10, name='e'),
            SourceMap(dst_line=0, dst_col=168, src='file2.js', src_line=9, src_col=2, name='Raven'),
            SourceMap(dst_line=0, dst_col=174, src='file2.js', src_line=9, src_col=8, name='captureException'),
            SourceMap(dst_line=0, dst_col=191, src='file2.js', src_line=9, src_col=25, name='e'),
        ]
