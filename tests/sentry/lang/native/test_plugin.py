from __future__ import absolute_import

from mock import patch

from sentry.models import Event
from sentry.testutils import TestCase
from sentry.lang.native.symbolizer import Symbolizer

from symsynd import parse_addr


class BasicResolvingIntegrationTest(TestCase):

    @patch('sentry.lang.native.symbolizer.Symbolizer._symbolize_app_frame')
    def test_frame_resolution(self, symbolize_frame):
        object_name = (
            "/var/containers/Bundle/Application/"
            "B33C37A8-F933-4B6B-9FFA-152282BFDF13/"
            "SentryTest.app/SentryTest"
        )

        symbolize_frame.return_value = [{
            'filename': 'Foo.swift',
            'abs_path': 'Foo.swift',
            'lineno': 42,
            'colno': 23,
            'package': object_name,
            'function': 'real_main',
            'symbol_addr': '0x1000262a0',
            "instruction_addr": '0x100026330',
        }]

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
                        "name": object_name,
                    }
                ],
                "sdk_info": {
                    "dsym_type": "macho",
                    "sdk_name": "iOS",
                    "version_major": 9,
                    "version_minor": 3,
                    "version_patchlevel": 0
                }
            },
            "sentry.interfaces.Exception": {
                "values": [
                    {
                        'stacktrace': {
                            "frames": [
                                {
                                    "function": "<redacted>",
                                    "abs_path": None,
                                    "package": "/usr/lib/system/libdyld.dylib",
                                    "filename": None,
                                    "symbol_addr": "0x002ac28b4",
                                    "lineno": None,
                                    "instruction_addr": "0x002ac28b8"
                                },
                                {
                                    "function": "main",
                                    "instruction_addr": 4295123760
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
            },
            "threads": {
                "values": [
                    {
                        "id": 39,
                        'stacktrace': {
                            "frames": [
                                {
                                    "platform": "apple",
                                    "package": "\/usr\/lib\/system\/libsystem_pthread.dylib",
                                    "symbol_addr": "0x00000001843a102c",
                                    "image_addr": "0x00000001843a0000",
                                    "instruction_addr": "0x00000001843a1530"
                                },
                                {
                                    "platform": "apple",
                                    "package": "\/usr\/lib\/system\/libsystem_kernel.dylib",
                                    "symbol_addr": "0x00000001842d8b40",
                                    "image_addr": "0x00000001842bc000",
                                    "instruction_addr": "0x00000001842d8b48"
                                }
                            ]
                        },
                        "crashed": False,
                        "current": False
                    }
                ]
            }
        }

        resp = self._postWithHeader(event_data)
        assert resp.status_code == 200

        event = Event.objects.get()

        bt = event.interfaces['sentry.interfaces.Exception'].values[0].stacktrace
        frames = bt.frames

        assert frames[0].function == '<redacted>'
        assert frames[0].instruction_addr == '0x2ac28b8'
        assert not frames[0].in_app

        assert frames[1].function == 'real_main'
        assert frames[1].filename == 'Foo.swift'
        assert frames[1].lineno == 42
        assert frames[1].colno == 23
        assert frames[1].package == object_name
        assert frames[1].instruction_addr == '0x100026330'
        assert frames[1].in_app

        assert frames[2].platform == 'javascript'
        assert frames[2].abs_path == '/scripts/views.js'
        assert frames[2].function == 'merge'
        assert frames[2].lineno == 268
        assert frames[2].colno == 16
        assert frames[2].filename == '../../sentry/scripts/views.js'
        assert frames[2].in_app

        assert len(event.interfaces['threads'].values) == 1

    def sym_app_frame(self, instruction_addr, img):
        object_name = (
            "/var/containers/Bundle/Application/"
            "B33C37A8-F933-4B6B-9FFA-152282BFDF13/"
            "SentryTest.app/SentryTest"
        )
        if not (4295098384 <= parse_addr(instruction_addr) < 4295098388):
            return [{
                'filename': 'Foo.swift',
                'abs_path': 'Foo.swift',
                'lineno': 82,
                'colno': 23,
                'package': object_name,
                'function': 'other_main',
                'symbol_addr': '0x1',
                "instruction_addr": '0x1',
            }]
        return [{
            'filename': 'Foo.swift',
            'abs_path': 'Foo.swift',
            'lineno': 42,
            'colno': 23,
            'package': object_name,
            'function': 'real_main',
            'symbol_addr': '0x1000262a0',
            "instruction_addr": '0x100026330',
        }]

    @patch.object(Symbolizer, '_symbolize_app_frame', sym_app_frame)
    def test_frame_resolution_no_sdk_info(self):
        object_name = (
            "/var/containers/Bundle/Application/"
            "B33C37A8-F933-4B6B-9FFA-152282BFDF13/"
            "SentryTest.app/SentryTest"
        )

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
                        "name": object_name,
                    }
                ]
            },
            "contexts": {
                "os": {
                    "name": "iOS",
                    "version": "9.3.0"
                }
            },
            "sentry.interfaces.Exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "<redacted>",
                                    "abs_path": None,
                                    "package": "/usr/lib/system/libdyld.dylib",
                                    "filename": None,
                                    "symbol_addr": "0x002ac28b4",
                                    "lineno": None,
                                    "instruction_addr": "0x002ac28b8"
                                },
                                {
                                    "function": "main",
                                    "instruction_addr": 4295098388,
                                },
                                {
                                    "function": "other_main",
                                    "instruction_addr": 4295098396
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

        resp = self._postWithHeader(event_data)
        assert resp.status_code == 200

        event = Event.objects.get()

        bt = event.interfaces['sentry.interfaces.Exception'].values[0].stacktrace
        frames = bt.frames

        assert frames[0].function == '<redacted>'
        assert frames[0].instruction_addr == '0x2ac28b8'
        assert not frames[0].in_app

        assert frames[1].function == 'real_main'
        assert frames[1].filename == 'Foo.swift'
        assert frames[1].lineno == 42
        assert frames[1].colno == 23
        assert frames[1].package == object_name
        assert frames[1].instruction_addr == '0x100020014'
        assert frames[1].in_app

        assert frames[2].function == 'other_main'
        assert frames[2].filename == 'Foo.swift'
        assert frames[2].lineno == 82
        assert frames[2].colno == 23
        assert frames[2].package == object_name
        assert frames[2].instruction_addr == '0x10002001c'
        assert frames[2].in_app

        assert frames[3].platform == 'javascript'
        assert frames[3].abs_path == '/scripts/views.js'
        assert frames[3].function == 'merge'
        assert frames[3].lineno == 268
        assert frames[3].colno == 16
        assert frames[3].filename == '../../sentry/scripts/views.js'
        assert frames[3].in_app

        x = bt.get_api_context()
        long_frames = x['frames']
        assert long_frames[0]['instructionAddr'] == '0x002ac28b8'
        assert long_frames[1]['instructionAddr'] == '0x100020014'
        assert long_frames[2]['instructionAddr'] == '0x10002001c'


class InAppHonoringResolvingIntegrationTest(TestCase):

    @patch('sentry.lang.native.symbolizer.Symbolizer._symbolize_app_frame')
    def test_frame_resolution(self, symbolize_frame):
        object_name = (
            "/var/containers/Bundle/Application/"
            "B33C37A8-F933-4B6B-9FFA-152282BFDF13/"
            "SentryTest.app/SentryTest"
        )

        symbolize_frame.return_value = [{
            'filename': 'Foo.swift',
            'abs_path': 'Foo.swift',
            'lineno': 42,
            'colno': 23,
            'package': object_name,
            'function': 'real_main',
            'symbol_addr': '0x1000262a0',
            "instruction_addr": '0x100026330',
        }]

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
                        "name": object_name,
                    }
                ],
                "sdk_info": {
                    "dsym_type": "macho",
                    "sdk_name": "iOS",
                    "version_major": 9,
                    "version_minor": 3,
                    "version_patchlevel": 0
                }
            },
            "sentry.interfaces.Exception": {
                "values": [
                    {
                        'stacktrace': {
                            "frames": [
                                {
                                    "function": "<redacted>",
                                    "abs_path": None,
                                    "package": "/usr/lib/system/libdyld.dylib",
                                    "filename": None,
                                    "symbol_addr": "0x002ac28b4",
                                    "lineno": None,
                                    "instruction_addr": "0x002ac28b8",
                                    "in_app": True,
                                },
                                {
                                    "function": "main",
                                    "instruction_addr": 4295123760,
                                    "in_app": False,
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
            },
            "threads": {
                "values": [
                    {
                        "id": 39,
                        'stacktrace': {
                            "frames": [
                                {
                                    "platform": "apple",
                                    "package": "\/usr\/lib\/system\/libsystem_pthread.dylib",
                                    "symbol_addr": "0x00000001843a102c",
                                    "image_addr": "0x00000001843a0000",
                                    "instruction_addr": "0x00000001843a1530"
                                },
                                {
                                    "platform": "apple",
                                    "package": "\/usr\/lib\/system\/libsystem_kernel.dylib",
                                    "symbol_addr": "0x00000001842d8b40",
                                    "image_addr": "0x00000001842bc000",
                                    "instruction_addr": "0x00000001842d8b48"
                                }
                            ]
                        },
                        "crashed": False,
                        "current": False
                    }
                ]
            }
        }

        resp = self._postWithHeader(event_data)
        assert resp.status_code == 200

        event = Event.objects.get()

        bt = event.interfaces['sentry.interfaces.Exception'].values[0].stacktrace
        frames = bt.frames

        assert frames[0].function == '<redacted>'
        assert frames[0].instruction_addr == '0x2ac28b8'
        assert frames[0].in_app

        assert frames[1].function == 'real_main'
        assert frames[1].filename == 'Foo.swift'
        assert frames[1].lineno == 42
        assert frames[1].colno == 23
        assert frames[1].package == object_name
        assert frames[1].instruction_addr == '0x100026330'
        assert not frames[1].in_app

        assert frames[2].platform == 'javascript'
        assert frames[2].abs_path == '/scripts/views.js'
        assert frames[2].function == 'merge'
        assert frames[2].lineno == 268
        assert frames[2].colno == 16
        assert frames[2].filename == '../../sentry/scripts/views.js'
        assert frames[2].in_app

        assert len(event.interfaces['threads'].values) == 1

    def sym_app_frame(self, instruction_addr, img):
        object_name = (
            "/var/containers/Bundle/Application/"
            "B33C37A8-F933-4B6B-9FFA-152282BFDF13/"
            "SentryTest.app/SentryTest"
        )
        if not (4295098384 <= parse_addr(instruction_addr) < 4295098388):
            return [{
                'filename': 'Foo.swift',
                'abs_path': 'Foo.swift',
                'lineno': 82,
                'colno': 23,
                'package': object_name,
                'function': 'other_main',
                'symbol_addr': '0x1',
                "instruction_addr": '0x1',
            }]
        return [{
            'filename': 'Foo.swift',
            'abs_path': 'Foo.swift',
            'lineno': 42,
            'colno': 23,
            'package': object_name,
            'function': 'real_main',
            'symbol_addr': '0x1000262a0',
            "instruction_addr": '0x100026330',
        }]

    @patch.object(Symbolizer, '_symbolize_app_frame', sym_app_frame)
    def test_frame_resolution_no_sdk_info(self):
        object_name = (
            "/var/containers/Bundle/Application/"
            "B33C37A8-F933-4B6B-9FFA-152282BFDF13/"
            "SentryTest.app/SentryTest"
        )

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
                        "name": object_name,
                    }
                ]
            },
            "contexts": {
                "os": {
                    "name": "iOS",
                    "version": "9.3.0"
                }
            },
            "sentry.interfaces.Exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "<redacted>",
                                    "abs_path": None,
                                    "package": "/usr/lib/system/libdyld.dylib",
                                    "filename": None,
                                    "symbol_addr": "0x002ac28b4",
                                    "lineno": None,
                                    "instruction_addr": "0x002ac28b8"
                                },
                                {
                                    "function": "main",
                                    "instruction_addr": 4295098388,
                                },
                                {
                                    "function": "other_main",
                                    "instruction_addr": 4295098396
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

        resp = self._postWithHeader(event_data)
        assert resp.status_code == 200

        event = Event.objects.get()

        bt = event.interfaces['sentry.interfaces.Exception'].values[0].stacktrace
        frames = bt.frames

        assert frames[0].function == '<redacted>'
        assert frames[0].instruction_addr == '0x2ac28b8'
        assert not frames[0].in_app

        assert frames[1].function == 'real_main'
        assert frames[1].filename == 'Foo.swift'
        assert frames[1].lineno == 42
        assert frames[1].colno == 23
        assert frames[1].package == object_name
        assert frames[1].instruction_addr == '0x100020014'
        assert frames[1].in_app

        assert frames[2].function == 'other_main'
        assert frames[2].filename == 'Foo.swift'
        assert frames[2].lineno == 82
        assert frames[2].colno == 23
        assert frames[2].package == object_name
        assert frames[2].instruction_addr == '0x10002001c'
        assert frames[2].in_app

        assert frames[3].platform == 'javascript'
        assert frames[3].abs_path == '/scripts/views.js'
        assert frames[3].function == 'merge'
        assert frames[3].lineno == 268
        assert frames[3].colno == 16
        assert frames[3].filename == '../../sentry/scripts/views.js'
        assert frames[3].in_app

        x = bt.get_api_context()
        long_frames = x['frames']
        assert long_frames[0]['instructionAddr'] == '0x002ac28b8'
        assert long_frames[1]['instructionAddr'] == '0x100020014'
        assert long_frames[2]['instructionAddr'] == '0x10002001c'

    @patch.object(Symbolizer, '_symbolize_app_frame', sym_app_frame)
    def test_in_app_function_name(self):
        object_name = (
            "/var/containers/Bundle/Application/"
            "B33C37A8-F933-4B6B-9FFA-152282BFDF13/"
            "SentryTest.app/SentryTest"
        )
        # '/var/containers/Bundle/Application/',
        # '/private/var/containers/Bundle/Application/',
        # (kscm_|kscrash_|KSCrash |SentryClient |RNSentry )
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
                        "name": object_name,
                    }
                ]
            },
            "contexts": {
                "os": {
                    "name": "iOS",
                    "version": "9.3.0"
                }
            },
            "sentry.interfaces.Exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "[RNSentry ]",
                                    "abs_path": None,
                                    "package": "/usr/lib/system/libdyld.dylib",
                                    "filename": None,
                                    "symbol_addr": "0x002ac28b4",
                                    "lineno": None,
                                    "instruction_addr": 4295098388,
                                },
                                {
                                    "function": "[SentryClient ]",
                                    "abs_path": None,
                                    "package": "/usr/lib/system/libdyld.dylib",
                                    "filename": None,
                                    "symbol_addr": "0x002ac28b4",
                                    "lineno": None,
                                    "instruction_addr": 4295098388,
                                },
                                {
                                    "function": "[kscrash_]",
                                    "abs_path": None,
                                    "package": "/usr/lib/system/libdyld.dylib",
                                    "filename": None,
                                    "symbol_addr": "0x002ac28b4",
                                    "lineno": None,
                                    "instruction_addr": 4295098388,
                                },
                                {
                                    "function": "[kscm_]",
                                    "abs_path": None,
                                    "package": "/usr/lib/system/libdyld.dylib",
                                    "filename": None,
                                    "symbol_addr": "0x002ac28b4",
                                    "lineno": None,
                                    "instruction_addr": 4295098388,
                                },
                                {
                                    "function": "[KSCrash ]",
                                    "abs_path": None,
                                    "package": "/usr/lib/system/libdyld.dylib",
                                    "filename": None,
                                    "symbol_addr": "0x002ac28b4",
                                    "lineno": None,
                                    "instruction_addr": 4295098388,
                                },
                                {
                                    "function": "[KSCrash]",
                                    "abs_path": None,
                                    "package": "/usr/lib/system/libdyld.dylib",
                                    "filename": None,
                                    "symbol_addr": "0x002ac28b4",
                                    "lineno": None,
                                    "instruction_addr": 4295098388,
                                },
                                {
                                    "function": "[KSCrashy]",
                                    "abs_path": None,
                                    "package": "/usr/lib/system/libdyld.dylib",
                                    "filename": None,
                                    "symbol_addr": "0x002ac28b4",
                                    "lineno": None,
                                    "instruction_addr": 4295098388,
                                },
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
        resp = self._postWithHeader(event_data)
        assert resp.status_code == 200

        event = Event.objects.get()

        bt = event.interfaces['sentry.interfaces.Exception'].values[0].stacktrace
        frames = bt.frames
        assert not frames[0].in_app
        assert not frames[1].in_app
        assert not frames[2].in_app
        assert not frames[3].in_app
        assert not frames[4].in_app
        assert frames[5].in_app
        assert frames[6].in_app

    def sym_mac_app_frame(self, instruction_addr, img):
        object_name = (
            "/Users/haza/Library/Developer/Xcode/Archives/2017-06-19/"
            "CrashProbe 19-06-2017, 08.53.xcarchive/Products/Applications/"
            "CrashProbe.app/Contents/Frameworks/"
            "CrashLib.framework/Versions/A/CrashLib"
        )
        if not (4295098384 <= parse_addr(instruction_addr) < 4295098388):
            return [{
                'filename': 'Foo.swift',
                'abs_path': 'Foo.swift',
                'lineno': 82,
                'colno': 23,
                'package': object_name,
                'function': 'other_main',
                'symbol_addr': '0x1',
                "instruction_addr": '0x1',
            }]
        return [{
            'filename': 'Foo.swift',
            'abs_path': 'Foo.swift',
            'lineno': 42,
            'colno': 23,
            'package': object_name,
            'function': 'real_main',
            'symbol_addr': '0x1000262a0',
            "instruction_addr": '0x100026330',
        }]

    @patch.object(Symbolizer, '_symbolize_app_frame', sym_mac_app_frame)
    def test_in_app_macos(self):
        object_name = (
            "/Users/haza/Library/Developer/Xcode/Archives/2017-06-19/"
            "CrashProbe 19-06-2017, 08.53.xcarchive/Products/Applications/"
            "CrashProbe.app/Contents/Frameworks/"
            "CrashLib.framework/Versions/A/CrashLib"
        )
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
                        "name": object_name,
                    }
                ]
            },
            "sentry.interfaces.Exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "-[CRLCrashAsyncSafeThread crash]",
                                    "abs_path": "/Users/haza/Projects/getsentry-CrashProbe/CrashProbe/CRLCrashAsyncSafeThread.m",
                                    "package": "/Users/haza/Library/Developer/Xcode/Archives/2017-06-19/CrashProbe 19-06-2017, 08.53.xcarchive/Products/Applications/CrashProbe.app/Contents/Frameworks/CrashLib.framework/Versions/A/CrashLib",
                                    "image_addr": "0x110121000",
                                    "symbol_addr": "0x110122303",
                                    "instruction_addr": 4295098388
                                },
                                {
                                    "function": "[KSCrash ]",
                                    "abs_path": None,
                                    "package": "/usr/lib/system/libdyld.dylib",
                                    "filename": None,
                                    "symbol_addr": "0x002ac28b4",
                                    "lineno": None,
                                    "instruction_addr": 4295098388,
                                },
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
            }
        }
        resp = self._postWithHeader(event_data)
        assert resp.status_code == 200

        event = Event.objects.get()

        bt = event.interfaces['sentry.interfaces.Exception'].values[0].stacktrace
        frames = bt.frames
        assert frames[0].in_app
