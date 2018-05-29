from __future__ import absolute_import

import os
import pytest
import zipfile
from mock import patch
from six import BytesIO

from django.conf import settings
from django.core.urlresolvers import reverse
from django.core.files.uploadedfile import SimpleUploadedFile

from sentry.testutils import TestCase
from sentry.lang.native.symbolizer import Symbolizer
from sentry.models import Event, File, ProjectDSymFile

from symbolic import parse_addr, Object, SymbolicError


class BasicResolvingIntegrationTest(TestCase):

    @pytest.mark.skipif(
        settings.SENTRY_TAGSTORE == 'sentry.tagstore.v2.V2TagStorage',
        reason='Queries are completly different when using tagstore'
    )
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

        # We do a preflight post, because there are many queries polluting the array
        # before the actual "processing" happens (like, auth_user)
        self._postWithHeader(event_data)
        with self.assertWriteQueries({
            'nodestore_node': 2,
            'sentry_environmentproject': 1,
            'sentry_eventtag': 1,
            'sentry_eventuser': 1,
            'sentry_filtervalue': 8,
            'sentry_groupedmessage': 1,
            'sentry_message': 1,
            'sentry_messagefiltervalue': 8,
            'sentry_userreport': 1
        }):
            resp = self._postWithHeader(event_data)

        assert resp.status_code == 200

        event = Event.objects.first()

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

    def sym_app_frame(self, instruction_addr, img, sdk_info=None):
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

    def sym_app_frame(self, instruction_addr, img, sdk_info=None):
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

    def sym_mac_app_frame(self, instruction_addr, img, sdk_info=None):
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
                    "family": "macOS",
                    "type": "device",
                    "storage_size": 498954403840,
                    "free_memory": 415174656,
                    "memory_size": 17179869184,
                    "boot_time": "2017-06-18T07:10:05Z",
                    "model": "MacBookPro13,1",
                    "usable_memory": 15204716544,
                    "arch": "x86"
                },
                "app": {
                    "app_version": "1.0",
                    "app_name": "CrashProbe",
                    "device_app_hash": "75e22adcce6cb4c81db7c7e623c2f2721616d2c8",
                    "executable_path": "/Users/haza/Library/Developer/Xcode/Archives/2017-06-19/CrashProbe 19-06-2017, 08.53.xcarchive/Products/Applications/CrashProbe.app/CrashProbe",
                    "build_type": "unknown",
                    "app_start_time": "2017-06-19T07:19:02Z",
                    "app_identifier": "net.hockeyapp.CrashProbe",
                    "type": "app",
                    "app_build": "1"
                },
                "os": {
                    "rooted": False,
                    "kernel_version": "Darwin Kernel Version 16.6.0: Fri Apr 14 16:21:16 PDT 2017; root:xnu-3789.60.24~6/RELEASE_X86_64",
                    "version": "10.12.5",
                    "build": "16F73",
                    "type": "os",
                    "name": "macOS"
                }
            },
        }
        resp = self._postWithHeader(event_data)
        assert resp.status_code == 200

        event = Event.objects.get()

        bt = event.interfaces['sentry.interfaces.Exception'].values[0].stacktrace
        frames = bt.frames
        assert frames[0].in_app


class RealResolvingIntegrationTest(TestCase):
    def test_real_resolving(self):
        url = reverse(
            'sentry-api-0-dsym-files',
            kwargs={
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
            }
        )

        self.login_as(user=self.user)

        out = BytesIO()
        f = zipfile.ZipFile(out, 'w')
        f.write(os.path.join(os.path.dirname(__file__), 'fixtures', 'hello.dsym'),
                'dSYM/hello')
        f.close()

        response = self.client.post(
            url, {
                'file':
                SimpleUploadedFile('symbols.zip', out.getvalue(), content_type='application/zip'),
            },
            format='multipart'
        )
        assert response.status_code == 201, response.content
        assert len(response.data) == 1

        event_data = {
            "project": self.project.id,
            "platform": "cocoa",
            "debug_meta": {
                "images": [{
                    "type": "apple",
                    "arch": "x86_64",
                    "uuid": "502fc0a5-1ec1-3e47-9998-684fa139dca7",
                    "image_vmaddr": "0x0000000100000000",
                    "image_size": 4096,
                    "image_addr": "0x0000000100000000",
                    "name": "Foo.app/Contents/Foo"
                }],
                "sdk_info": {
                    "dsym_type": "macho",
                    "sdk_name": "macOS",
                    "version_major": 10,
                    "version_minor": 12,
                    "version_patchlevel": 4,
                }
            },
            "sentry.interfaces.Exception": {
                "values": [
                    {
                        'stacktrace': {
                            "frames": [
                                {
                                    "function": "unknown",
                                    "instruction_addr": "0x0000000100000fa0"
                                },
                            ]
                        },
                        "type": "Fail",
                        "value": "fail"
                    }
                ]
            },
        }

        resp = self._postWithHeader(event_data)
        assert resp.status_code == 200

        event = Event.objects.get()

        bt = event.interfaces['sentry.interfaces.Exception'].values[0].stacktrace
        frames = bt.frames

        assert frames[0].function == 'main'
        assert frames[0].filename == 'hello.c'
        assert frames[0].abs_path == '/tmp/hello.c'
        assert frames[0].lineno == 1

    def test_broken_conversion(self):
        url = reverse(
            'sentry-api-0-dsym-files',
            kwargs={
                'organization_slug': self.project.organization.slug,
                'project_slug': self.project.slug,
            }
        )

        self.login_as(user=self.user)

        out = BytesIO()
        f = zipfile.ZipFile(out, 'w')
        f.write(os.path.join(os.path.dirname(__file__), 'fixtures', 'hello.dsym'),
                'dSYM/hello')
        f.close()

        original_make_symcache = Object.make_symcache

        def broken_make_symcache(self):
            raise SymbolicError('shit on fire')
        Object.make_symcache = broken_make_symcache
        try:
            response = self.client.post(
                url, {
                    'file':
                    SimpleUploadedFile(
                        'symbols.zip',
                        out.getvalue(),
                        content_type='application/zip'),
                },
                format='multipart'
            )
            assert response.status_code == 201, response.content
            assert len(response.data) == 1

            event_data = {
                "project": self.project.id,
                "platform": "cocoa",
                "debug_meta": {
                    "images": [{
                        "type": "apple",
                        "arch": "x86_64",
                        "uuid": "502fc0a5-1ec1-3e47-9998-684fa139dca7",
                        "image_vmaddr": "0x0000000100000000",
                        "image_size": 4096,
                        "image_addr": "0x0000000100000000",
                        "name": "Foo.app/Contents/Foo"
                    }],
                    "sdk_info": {
                        "dsym_type": "macho",
                        "sdk_name": "macOS",
                        "version_major": 10,
                        "version_minor": 12,
                        "version_patchlevel": 4,
                    }
                },
                "sentry.interfaces.Exception": {
                    "values": [
                        {
                            'stacktrace': {
                                "frames": [
                                    {
                                        "function": "unknown",
                                        "instruction_addr": "0x0000000100000fa0"
                                    },
                                ]
                            },
                            "type": "Fail",
                            "value": "fail"
                        }
                    ]
                },
            }

            for _ in range(3):
                resp = self._postWithHeader(event_data)
                assert resp.status_code == 200
                event = Event.objects.get()
                errors = event.data['errors']
                assert len(errors) == 1
                assert errors[0] == {
                    'image_arch': u'x86_64',
                    'image_path': u'Foo.app/Contents/Foo',
                    'image_uuid': u'502fc0a5-1ec1-3e47-9998-684fa139dca7',
                    'message': u'shit on fire',
                    'type': 'native_bad_dsym'
                }
                event.delete()
        finally:
            Object.make_symcache = original_make_symcache

    def test_debug_id_resolving(self):
        file = File.objects.create(
            name='crash.pdb',
            type='default',
            headers={'Content-Type': 'text/x-breakpad'},
        )

        path = os.path.join(os.path.dirname(__file__), 'fixtures', 'windows.sym')
        with open(path) as f:
            file.putfile(f)

        ProjectDSymFile.objects.create(
            file=file,
            object_name='crash.pdb',
            cpu_name='x86',
            project=self.project,
            debug_id='3249d99d-0c40-4931-8610-f4e4fb0b6936-1',
        )

        self.login_as(user=self.user)

        event_data = {
            'contexts': {
                'device': {
                    'arch': 'x86'
                },
                'os': {
                    'build': u'',
                    'name': 'Windows',
                    'type': 'os',
                    'version': u'10.0.14393'
                }
            },
            'debug_meta': {
                'images': [
                    {
                        'id': u'3249d99d-0c40-4931-8610-f4e4fb0b6936-1',
                        'image_addr': '0x2a0000',
                        'image_size': 36864,
                        'name': u'C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe',
                        'type': 'symbolic'
                    }
                ]
            },
            'exception': {
                'stacktrace': {
                    'frames': [
                        {
                            'function': '<unknown>',
                            'instruction_addr': '0x2a2a3d',
                            'package': u'C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe'
                        }
                    ]
                },
                'thread_id': 1636,
                'type': u'EXCEPTION_ACCESS_VIOLATION_WRITE',
                'value': u'Fatal Error: EXCEPTION_ACCESS_VIOLATION_WRITE'
            },
            'platform': 'native'
        }

        resp = self._postWithHeader(event_data)
        assert resp.status_code == 200

        event = Event.objects.get()

        bt = event.interfaces['sentry.interfaces.Exception'].values[0].stacktrace
        frames = bt.frames

        assert frames[0].function == 'main'
        # NOTE: Breakpad symbols only contain entire paths
        assert frames[0].filename == 'c:\\projects\\breakpad-tools\\windows\\crash\\main.cpp'
        assert frames[0].abs_path == 'c:\\projects\\breakpad-tools\\windows\\crash\\main.cpp'
        assert frames[0].lineno == 35


class ExceptionMechanismIntegrationTest(TestCase):

    def test_full_mechanism(self):
        event_data = {
            "sentry.interfaces.User": {
                "ip_address": "31.172.207.97"
            },
            "extra": {},
            "project": self.project.id,
            "platform": "cocoa",
            "debug_meta": {
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
                        "stacktrace": {
                            "frames": []
                        },
                        "type": "NSRangeException",
                        "mechanism": {
                            "type": "mach",
                            "meta": {
                                "signal": {
                                    "number": 6,
                                    "code": 0,
                                    "name": "SIGABRT"
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
            }
        }

        resp = self._postWithHeader(event_data)
        assert resp.status_code == 200

        event = Event.objects.get()

        mechanism = event.interfaces['sentry.interfaces.Exception'].values[0].mechanism

        assert mechanism.type == 'mach'
        assert mechanism.meta['signal']['number'] == 6
        assert mechanism.meta['signal']['code'] == 0
        assert mechanism.meta['signal']['name'] == 'SIGABRT'
        assert mechanism.meta['mach_exception']['exception'] == 10
        assert mechanism.meta['mach_exception']['code'] == 0
        assert mechanism.meta['mach_exception']['subcode'] == 0
        assert mechanism.meta['mach_exception']['name'] == 'EXC_CRASH'

    def test_mechanism_name_expansion(self):
        event_data = {
            "sentry.interfaces.User": {
                "ip_address": "31.172.207.97"
            },
            "extra": {},
            "project": self.project.id,
            "platform": "cocoa",
            "debug_meta": {
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
                        "stacktrace": {
                            "frames": []
                        },
                        "type": "NSRangeException",
                        "mechanism": {
                            "type": "mach",
                            "meta": {
                                "signal": {
                                    "number": 10,
                                    "code": 0
                                },
                                "mach_exception": {
                                    "subcode": 0,
                                    "code": 0,
                                    "exception": 10
                                }
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

        mechanism = event.interfaces['sentry.interfaces.Exception'].values[0].mechanism

        assert mechanism.type == 'mach'
        assert mechanism.meta['signal']['number'] == 10
        assert mechanism.meta['signal']['code'] == 0
        assert mechanism.meta['signal']['name'] == 'SIGBUS'
        assert mechanism.meta['signal']['code_name'] == 'BUS_NOOP'
        assert mechanism.meta['mach_exception']['exception'] == 10
        assert mechanism.meta['mach_exception']['code'] == 0
        assert mechanism.meta['mach_exception']['subcode'] == 0
        assert mechanism.meta['mach_exception']['name'] == 'EXC_CRASH'

    def test_legacy_mechanism(self):
        event_data = {
            "sentry.interfaces.User": {
                "ip_address": "31.172.207.97"
            },
            "extra": {},
            "project": self.project.id,
            "platform": "cocoa",
            "debug_meta": {
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
                        "stacktrace": {
                            "frames": []
                        },
                        "type": "NSRangeException",
                        "mechanism": {
                            "posix_signal": {
                                "signal": 6,
                                "code": 0,
                                "name": "SIGABRT"
                            },
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

        mechanism = event.interfaces['sentry.interfaces.Exception'].values[0].mechanism

        # NOTE: legacy mechanisms are always classified "generic"
        assert mechanism.type == 'generic'
        assert mechanism.meta['signal']['number'] == 6
        assert mechanism.meta['signal']['code'] == 0
        assert mechanism.meta['signal']['name'] == 'SIGABRT'
        assert mechanism.meta['mach_exception']['exception'] == 10
        assert mechanism.meta['mach_exception']['code'] == 0
        assert mechanism.meta['mach_exception']['subcode'] == 0
        assert mechanism.meta['mach_exception']['name'] == 'EXC_CRASH'
