from __future__ import absolute_import

from mock import patch

from sentry.testutils import TestCase
from sentry.lang.native.plugin import resolve_frame_symbols


OBJECT_NAME = (
    "/var/containers/Bundle/Application/B33C37A8-F933-4B6B-9FFA-152282BFDF13/"
    "SentryTest.app/SentryTest"
)

SDK_INFO = {
    "dsym_type": "macho",
    "sdk_name": "iOS",
    "version_major": 9,
    "version_minor": 3,
    "version_patchlevel": 0
}


def patched_symbolize_app_frame(self, frame):
    if frame['instruction_addr'] == 4295123760:
        return {
            'filename': 'Foo.swift',
            'line': 42,
            'column': 23,
            'object_name': OBJECT_NAME,
            'symbol_name': 'real_main',
            'symbol_addr': '0x1000262a0',
            'instruction_addr': '0x100026330',
        }


def patched_symbolize_system_frame(self, frame, sdk_info):
    assert sdk_info == SDK_INFO
    if frame['instruction_addr'] == 4295123360:
        return {
            'object_name': '/usr/lib/whatever.dylib',
            'symbol_name': 'whatever_system',
            'symbol_addr': '0x100026110',
            'instruction_addr': '0x1000261a0',
        }


class BasicResolvingFileTest(TestCase):

    @patch('sentry.lang.native.symbolizer.Symbolizer.symbolize_app_frame',
           new=patched_symbolize_app_frame)
    @patch('sentry.lang.native.symbolizer.Symbolizer.symbolize_system_frame',
           new=patched_symbolize_system_frame)
    def test_frame_resolution(self):
        event_data = {
            "sentry.interfaces.User": {
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
                        "image_addr": 4295098368,
                        "cpu_type": 16777228,
                        "image_size": 32768,
                        "name": OBJECT_NAME,
                    }
                ],
                "sdk_info": SDK_INFO,
            },
            "sentry.interfaces.Exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "<redacted>",
                                    "abs_path": None,
                                    "instruction_offset": 4,
                                    "package": "/usr/lib/system/libdyld.dylib",
                                    "filename": None,
                                    "symbol_addr": "0x002ac28b4",
                                    "lineno": None,
                                    "in_app": False,
                                    "instruction_addr": "0x002ac28b8"
                                },
                                {
                                    "function": "main",
                                    "instruction_addr": 4295123760,
                                    "symbol_addr": 4295123616,
                                    "image_addr": 4295098368
                                },
                                {
                                    "function": "whatever_system",
                                    "instruction_addr": 4295123360,
                                    "symbol_addr": 4295123216,
                                    "image_addr": 4295092368
                                },
                                {
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
                        "type": "NSRangeException",
                        "mechanism": {
                            "posix_signal": {
                                "signal": 6,
                                "code": 0,
                                "name": "SIGABRT",
                                "code_name": None
                            },
                            "type": "cocoa",
                            "mach_exception": {
                                "subcode": 0,
                                "code": 0,
                                "exception": 10,
                                "exception_name": "EXC_CRASH"
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
                    "model_id": "N102AP",
                    "model": "iPod7,1",
                    "arch": "arm64",
                    "family": "iPod"
                },
                "os": {
                    "version": "9.3.2",
                    "rooted": False,
                    "build": "13F69",
                    "name": "iOS"
                }
            }
        }

        resolve_frame_symbols(event_data)

        bt = event_data['sentry.interfaces.Exception']['values'][0]['stacktrace']
        frames = bt['frames']

        assert frames[0]['function'] == '<redacted>'
        assert frames[0]['instruction_addr'] == '0x002ac28b8'

        assert frames[1]['function'] == 'real_main'
        assert frames[1]['lineno'] == 42
        assert frames[1]['colno'] == 23
        assert frames[1]['package'] == OBJECT_NAME
        assert frames[1]['instruction_addr'] == '0x100026330'
        assert frames[1].get('instruction_offset') is None

        assert frames[2]['function'] == 'whatever_system'
        assert frames[2]['package'] == '/usr/lib/whatever.dylib'
        assert frames[2]['instruction_addr'] == '0x1000261a0'
        assert frames[2].get('instruction_offset') == 144
