from __future__ import absolute_import
import os

from sentry.lang.native.utils import get_sdk_from_event, cpu_name_from_data, \
    version_build_from_data, merge_minidump_event


def test_get_sdk_from_event():
    sdk_info = get_sdk_from_event(
        {
            'debug_meta': {
                'sdk_info': {
                    'sdk_name': 'iOS',
                    'version_major': 9,
                    'version_minor': 3,
                    'version_patchlevel': 0,
                }
            }
        }
    )
    assert sdk_info['sdk_name'] == 'iOS'
    assert sdk_info['version_major'] == 9
    assert sdk_info['version_minor'] == 3
    assert sdk_info['version_patchlevel'] == 0

    sdk_info = get_sdk_from_event(
        {
            'contexts': {
                'os': {
                    'type': 'os',
                    'name': 'iOS',
                    'version': '9.3.1.1234',
                }
            }
        }
    )

    assert sdk_info['sdk_name'] == 'iOS'
    assert sdk_info['version_major'] == 9
    assert sdk_info['version_minor'] == 3
    assert sdk_info['version_patchlevel'] == 1


def test_cpu_name_from_data():
    cpu_name = cpu_name_from_data(
        {
            'contexts': {
                'device': {
                    'type': 'device',
                    'arch': 'arm64'
                },
                'device2': {
                    'type': 'device',
                    'arch': 'arm7'
                },
            }
        }
    )

    assert cpu_name == 'arm64'


def test_version_build_from_data():

    app_info = version_build_from_data(
        {
            'contexts': {
                'app': {
                    'app_build': "2",
                    'device_app_hash': "18482a73f96d2ed3f4ce8d73fa9942744bff3598",
                    'app_id': "45BA82DF-F3E3-37F7-9D88-12A1AAB719E7",
                    'app_version': "1.0",
                    'app_identifier': "com.rokkincat.SentryExample",
                    'app_name': "SwiftExample",
                    'app_start_time': "2017-03-28T15:14:01Z",
                    'type': "app",
                    'build_type': "simulator"
                }
            }
        }
    )
    assert app_info.version == '1.0'
    assert app_info.build == '2'
    assert app_info.name == 'SwiftExample'
    assert app_info.id == 'com.rokkincat.SentryExample'

    app_info = version_build_from_data(
        {
            'contexts': {
                'app': {
                    'device_app_hash': "18482a73f96d2ed3f4ce8d73fa9942744bff3598",
                    'app_id': "45BA82DF-F3E3-37F7-9D88-12A1AAB719E7",
                    'app_version': "1.0",
                    'app_identifier': "com.rokkincat.SentryExample",
                    'app_name': "SwiftExample",
                    'app_start_time': "2017-03-28T15:14:01Z",
                    'type': "app",
                    'build_type': "simulator"
                }
            }
        }
    )
    assert app_info is None

    app_info = version_build_from_data(
        {
            'contexts': {
                'app': {
                    'device_app_hash': "18482a73f96d2ed3f4ce8d73fa9942744bff3598",
                    'app_id': "45BA82DF-F3E3-37F7-9D88-12A1AAB719E7",
                    'app_identifier': "com.rokkincat.SentryExample",
                    'app_name': "SwiftExample",
                    'app_start_time': "2017-03-28T15:14:01Z",
                    'type': "app",
                    'build_type': "simulator"
                }
            }
        }
    )
    assert app_info is None

    app_info = version_build_from_data(
        {
            'contexts': {
                'bal': {
                    'device_app_hash': "18482a73f96d2ed3f4ce8d73fa9942744bff3598",
                }
            }
        }
    )
    assert app_info is None


def test_cpu_name_from_data_inferred_type():
    cpu_name = cpu_name_from_data(
        {
            'contexts': {
                'some_device': {
                    'type': 'device',
                    'arch': 'arm64'
                }
            }
        }
    )

    assert cpu_name == 'arm64'


def test_minidump_linux():
    event = {'release': 'test-1.0.0'}
    minidump = os.path.join(os.path.dirname(__file__), 'fixtures', 'linux.dmp')
    merge_minidump_event(event, minidump)

    assert event == {
        'contexts': {
            'device': {
                'arch': 'x86_64'
            },
            'os': {
                'build': u'#1 SMP Mon Nov 6 16:00:12 UTC 2017',
                'name': u'Linux',
                'type': 'os',
                'version': u'4.9.60-linuxkit-aufs'
            }
        },
        'debug_meta': {
            'images': [
                {
                    'id': u'451a38b5-0679-79d2-0738-22a5ceb24c4b',
                    'image_addr': '0x7f514015d000',
                    'image_size': 1835008,
                    'name': u'/lib/x86_64-linux-gnu/libc-2.23.so',
                    'type': 'symbolic'
                },
                {
                    'id': u'59627b5d-2255-a375-c17b-d4c3fd05f5a6',
                    'image_addr': '0x7f5140cdc000',
                    'image_size': 155648,
                    'name': u'/lib/x86_64-linux-gnu/ld-2.23.so',
                    'type': 'symbolic'
                },
                {
                    'id': u'c0bcc3f1-9827-fe65-3058-404b2831d9e6',
                    'image_addr': '0x400000',
                    'image_size': 106496,
                    'name': u'/work/linux/build/crash',
                    'type': 'symbolic'
                }
            ]
        },
        'exception': {
            'mechanism': {
                'type': 'minidump',
                'handled': False
            },
            'stacktrace': {
                'frames': [
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x401dc0',
                        'package': u'/work/linux/build/crash'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7f5140cdc000',
                        'package': None
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x400040',
                        'package': u'/work/linux/build/crash'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7fff5aef1000',
                        'package': None
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x401de9',
                        'package': u'/work/linux/build/crash'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x401dc0',
                        'package': u'/work/linux/build/crash'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x414ca0',
                        'package': u'/work/linux/build/crash'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x401c70',
                        'package': u'/work/linux/build/crash'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x401dc0',
                        'package': u'/work/linux/build/crash'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x401c70',
                        'package': u'/work/linux/build/crash'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7f514017d830',
                        'package': u'/lib/x86_64-linux-gnu/libc-2.23.so'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x414c30',
                        'package': u'/work/linux/build/crash'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x401ec0',
                        'package': u'/work/linux/build/crash'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7f5140cebac6',
                        'package': u'/lib/x86_64-linux-gnu/ld-2.23.so'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x400000',
                        'package': None
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7f51401e4800',
                        'package': u'/lib/x86_64-linux-gnu/libc-2.23.so'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7f514025002e',
                        'package': u'/lib/x86_64-linux-gnu/libc-2.23.so'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x401d72',
                        'package': u'/work/linux/build/crash'
                    }
                ]
            },
            'thread_id': 1304,
            'type': u'SIGSEGV',
            'value': u'Fatal Error: SIGSEGV'
        },
        'level': 'fatal',
        'message': u'Fatal Error: SIGSEGV',
        'platform': 'native',
        'release': 'test-1.0.0',
        'threads': [
            {
                'crashed': True,
                'id': 1304
            }
        ],
        'timestamp': 1522061032.0
    }


def test_minidump_macos():
    event = {'release': 'test-1.0.0'}
    minidump = os.path.join(os.path.dirname(__file__), 'fixtures', 'macos.dmp')
    merge_minidump_event(event, minidump)

    assert event == {
        'contexts': {
            'device': {
                'arch': 'x86_64'
            },
            'os': {
                'build': u'16G29',
                'name': 'macOS',
                'type': 'os',
                'version': u'10.12.6'
            }
        },
        'debug_meta': {
            'images': [
                {
                    'id': u'67e9247c-814e-392b-a027-dbde6748fcbf',
                    'image_addr': '0x109b9b000',
                    'image_size': 69632,
                    'name': u'/Users/travis/build/getsentry/breakpad-tools/macos/build/./crash',
                    'type': 'symbolic'
                },
                {
                    'id': u'9b2ac56d-107c-3541-a127-9094a751f2c9',
                    'image_addr': '0x7fffe7ee6000',
                    'image_size': 24576,
                    'name': u'/usr/lib/system/libdyld.dylib',
                    'type': 'symbolic'
                }
            ]
        },
        'exception': {
            'mechanism': {
                'type': 'minidump',
                'handled': False
            },
            'stacktrace': {
                'frames': [
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7fffe7eeb235',
                        'package': u'/usr/lib/system/libdyld.dylib'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7fffe7eeb235',
                        'package': u'/usr/lib/system/libdyld.dylib'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x109ba8c70',
                        'package': u'/Users/travis/build/getsentry/breakpad-tools/macos/build/./crash'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x109ba8c15',
                        'package': u'/Users/travis/build/getsentry/breakpad-tools/macos/build/./crash'
                    }
                ]
            },
            'thread_id': 775,
            'type': u'EXC_BAD_ACCESS / KERN_INVALID_ADDRESS',
            'value': u'Fatal Error: EXC_BAD_ACCESS / KERN_INVALID_ADDRESS'
        },
        'level': 'fatal',
        'message': u'Fatal Error: EXC_BAD_ACCESS / KERN_INVALID_ADDRESS',
        'platform': 'native',
        'release': 'test-1.0.0',
        'threads': [
            {
                'crashed': True,
                'id': 775
            }
        ],
        'timestamp': 1521713398.0
    }


def test_minidump_windows():
    event = {'release': 'test-1.0.0'}
    minidump = os.path.join(os.path.dirname(__file__), 'fixtures', 'windows.dmp')
    merge_minidump_event(event, minidump)

    assert event == {
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
                },
                {
                    'id': u'971f98e5-ce60-41ff-b2d7-235bbeb34578-1',
                    'image_addr': '0x77170000',
                    'image_size': 1585152,
                    'name': u'C:\\Windows\\System32\\ntdll.dll',
                    'type': 'symbolic'
                },
                {
                    'id': u'ae131c67-27a7-4fa1-9916-b5a4aef41190-1',
                    'image_addr': '0x75810000',
                    'image_size': 790528,
                    'name': u'C:\\Windows\\System32\\rpcrt4.dll',
                    'type': 'symbolic'
                },
                {
                    'id': u'aec7ef2f-df4b-4642-a471-4c3e5fe8760a-1',
                    'image_addr': '0x70b70000',
                    'image_size': 151552,
                    'name': u'C:\\Windows\\System32\\dbgcore.dll',
                    'type': 'symbolic'
                },
                {
                    'id': u'd3474559-96f7-47d6-bf43-c176b2171e68-1',
                    'image_addr': '0x75050000',
                    'image_size': 917504,
                    'name': u'C:\\Windows\\System32\\kernel32.dll',
                    'type': 'symbolic'
                }
            ]
        },
        'exception': {
            'mechanism': {
                'type': 'minidump',
                'handled': False
            },
            'stacktrace': {
                'frames': [
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x771d0f44',
                        'package': u'C:\\Windows\\System32\\ntdll.dll'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x771d0f79',
                        'package': u'C:\\Windows\\System32\\ntdll.dll'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x750662c4',
                        'package': u'C:\\Windows\\System32\\kernel32.dll'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x2a2d97',
                        'package': u'C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x2a3435',
                        'package': u'C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7584e9c0',
                        'package': u'C:\\Windows\\System32\\rpcrt4.dll'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x75810000',
                        'package': None
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x70b7ae40',
                        'package': u'C:\\Windows\\System32\\dbgcore.dll'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x70850000',
                        'package': None
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7584e9c0',
                        'package': u'C:\\Windows\\System32\\rpcrt4.dll'
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x2a28d0',
                        'package': u'C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe'
                    },
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
        'level': 'fatal',
        'message': u'Fatal Error: EXCEPTION_ACCESS_VIOLATION_WRITE',
        'platform': 'native',
        'release': 'test-1.0.0',
        'threads': [
            {
                'crashed': True,
                'id': 1636
            },
            {
                'crashed': False,
                'id': 3580,
                'stacktrace': {
                    'frames': [{
                        'function': '<unknown>',
                        'instruction_addr': '0x771d0f44',
                        'package': u'C:\\Windows\\System32\\ntdll.dll'
                    },
                        {
                        'function': '<unknown>',
                        'instruction_addr': '0x771d0f79',
                        'package': u'C:\\Windows\\System32\\ntdll.dll'
                    },
                        {
                        'function': '<unknown>',
                        'instruction_addr': '0x750662c4',
                        'package': u'C:\\Windows\\System32\\kernel32.dll'
                    },
                        {
                        'function': '<unknown>',
                        'instruction_addr': '0x771e016c',
                        'package': u'C:\\Windows\\System32\\ntdll.dll'
                    }]
                }
            },
            {
                'crashed': False,
                'id': 2600,
                'stacktrace': {
                    'frames': [{
                        'function': '<unknown>',
                        'instruction_addr': '0x771d0f44',
                        'package': u'C:\\Windows\\System32\\ntdll.dll'
                    },
                        {
                        'function': '<unknown>',
                        'instruction_addr': '0x771d0f79',
                        'package': u'C:\\Windows\\System32\\ntdll.dll'
                    },
                        {
                        'function': '<unknown>',
                        'instruction_addr': '0x750662c4',
                        'package': u'C:\\Windows\\System32\\kernel32.dll'
                    },
                        {
                        'function': '<unknown>',
                        'instruction_addr': '0x771e016c',
                        'package': u'C:\\Windows\\System32\\ntdll.dll'
                    }]
                }
            },
            {
                'crashed': False,
                'id': 2920,
                'stacktrace': {
                    'frames': [{
                        'function': '<unknown>',
                        'instruction_addr': '0x771df3dc',
                        'package': u'C:\\Windows\\System32\\ntdll.dll'
                    }]
                }
            }
        ],
        'timestamp': 1521713273.0
    }
