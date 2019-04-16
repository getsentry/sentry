from __future__ import absolute_import

from mock import patch

from sentry.lang.native.plugin import NativeStacktraceProcessor
from sentry.stacktraces import process_stacktraces
from sentry.testutils import TestCase

OBJECT_NAME = (
    "/var/containers/Bundle/Application/B33C37A8-F933-4B6B-9FFA-152282BFDF13/"
    "SentryTest.app/SentryTest"
)

SDK_INFO = {"sdk_name": "iOS", "version_major": 9,
            "version_minor": 3, "version_patchlevel": 0}


def patched_symbolize_app_frame(self, instruction_addr, img, sdk_info=None, trust=None):
    if instruction_addr != 4295123756:
        return []
    return [
        {
            'filename': 'Foo.swift',
            'abs_path': 'Foo.swift',
            'lineno': 42,
            'colno': 23,
            'package': OBJECT_NAME,
            'function': 'real_main',
        }
    ]


def patched_convert_symbolserver_match(self, instruction_addr, symbolserver_match):
    if 6016 <= instruction_addr < 6020:
        return [
            {
                'abs_path': None,
                'filename': None,
                'package': '/usr/lib/whatever.dylib',
                'function': 'whatever_system',
            }
        ]
    return []


class BasicResolvingFileTest(TestCase):
    @patch(
        'sentry.lang.native.symbolizer.Symbolizer._symbolize_app_frame',
        new=patched_symbolize_app_frame
    )
    @patch(
        'sentry.lang.native.symbolizer.Symbolizer._convert_symbolserver_match',
        new=patched_convert_symbolserver_match
    )
    def test_frame_resolution(self):
        event_data = {
            "user": {
                "ip_address": "31.172.207.97"
            },
            "extra": {},
            "project": self.project.id,
            "platform": "cocoa",
            "debug_meta": {
                "images": [
                    {
                        "type": "apple",
                        "cpu_subtype": 0,
                        "uuid": "C05B4DDD-69A7-3840-A649-32180D341587",
                        "image_vmaddr": 4294967296,
                        "image_addr": 4295121760,
                        "cpu_type": 16777228,
                        "image_size": 32768,
                        "name": OBJECT_NAME,
                    }, {
                        "type": "apple",
                        "cpu_subtype": 0,
                        "cpu_type": 16777228,
                        "uuid": "B78CB4FB-3A90-4039-9EFD-C58932803AE5",
                        "image_vmaddr": 0,
                        "image_addr": 6000,
                        "cpu_type": 16777228,
                        "image_size": 32768,
                        'name': '/usr/lib/whatever.dylib',
                    }
                ],
                "sdk_info":
                SDK_INFO,
            },
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "<redacted>",
                                    "abs_path": None,
                                    "package": "/usr/lib/system/libdyld.dylib",
                                    "filename": None,
                                    "lineno": None,
                                    "in_app": False,
                                    "instruction_addr": 6010,
                                }, {
                                    "function": "main",
                                    "instruction_addr": 4295123760
                                }, {
                                    "function": "whatever_system",
                                    "instruction_addr": 6020,
                                    "symbol_addr": 6016,
                                }, {
                                    "platform": "javascript",
                                    "function": "merge",
                                    "abs_path": "/scripts/views.js",
                                    "vars": {},
                                    "module": None,
                                    "filename": "../../sentry/scripts/views.js",
                                    "colno": 16,
                                    "in_app": True,
                                    "lineno": 268
                                }
                            ]
                        },
                        "type":
                        "NSRangeException",
                        "mechanism": {
                            "type": "mach",
                            "meta": {
                                "signal": {
                                    "number": 6,
                                    "code": 0,
                                    "name": "SIGABRT",
                                    "code_name": None
                                },
                                "mach_exception": {
                                    "subcode": 0,
                                    "code": 0,
                                    "exception": 10,
                                    "name": "EXC_CRASH"
                                }
                            }
                        },
                        "value": (
                            "*** -[__NSArray0 objectAtIndex:]: index 3 "
                            "beyond bounds for empty NSArray"
                        )
                    }
                ]
            },
            "contexts": {
                "device": {
                    "type": "device",
                    "model_id": "N102AP",
                    "model": "iPod7,1",
                    "arch": "arm64",
                    "family": "iPod"
                },
                "os": {
                    "type": "os",
                    "version": "9.3.2",
                    "rooted": False,
                    "build": "13F69",
                    "name": "iOS"
                }
            }
        }

        def make_processors(data, infos):
            return [NativeStacktraceProcessor(data, infos)]

        event_data = process_stacktraces(
            event_data, make_processors=make_processors)

        bt = event_data['exception']['values'][0]['stacktrace']
        frames = bt['frames']

        assert frames[0]['function'] == '<redacted>'
        assert frames[0]['instruction_addr'] == 6010

        assert frames[1]['function'] == 'real_main'
        assert frames[1]['lineno'] == 42
        assert frames[1]['colno'] == 23
        assert frames[1]['package'] == OBJECT_NAME
        assert frames[1]['instruction_addr'] == 4295123760

        assert frames[2]['function'] == 'whatever_system'
        assert frames[2]['package'] == '/usr/lib/whatever.dylib'
        assert frames[2]['instruction_addr'] == 6020
