from __future__ import absolute_import
import os

from sentry.lang.native.minidump import process_minidump, merge_process_state_event, is_minidump_event


def test_is_minidump():
    assert is_minidump_event({
        'exception': {
            'values': [{
                'mechanism': {
                    'type': 'minidump'
                }
            }]
        }
    })

    assert not is_minidump_event({
        'exception': {
            'values': [{
                'mechanism': {
                    'type': 'other'
                }
            }]
        }
    })

    assert not is_minidump_event({
        'exception': {
            'values': [{
                'mechanism': {
                    'type': None
                }
            }]
        }
    })

    assert not is_minidump_event({
        'exception': {
            'values': [{
                'mechanism': None
            }]
        }
    })

    assert not is_minidump_event({
        'exception': {
            'values': [None]
        }
    })

    assert not is_minidump_event({
        'exception': {
            'values': []
        }
    })

    assert not is_minidump_event({
        'exception': {
            'values': None
        }
    })

    assert not is_minidump_event({
        'exception': None
    })


def test_minidump_linux():
    event = {'release': 'test-1.0.0'}
    minidump = os.path.join(os.path.dirname(__file__), 'fixtures', 'linux.dmp')
    with open(minidump, 'rb') as f:
        state = process_minidump(f.read())
        merge_process_state_event(event, state)

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
                    'id': u'c0bcc3f1-9827-fe65-3058-404b2831d9e6',
                    'image_addr': '0x400000',
                    'image_size': 106496,
                    'name': u'/work/linux/build/crash',
                    'type': 'symbolic'
                },
                {
                    'id': u'e45db8df-af2d-09fd-640c-8fe377d572de',
                    'image_addr': '0x7f513fe54000',
                    'image_size': 1081344,
                    'name': u'/lib/x86_64-linux-gnu/libm-2.23.so',
                    'type': 'symbolic'
                },
                {
                    'id': u'451a38b5-0679-79d2-0738-22a5ceb24c4b',
                    'image_addr': '0x7f514015d000',
                    'image_size': 1835008,
                    'name': u'/lib/x86_64-linux-gnu/libc-2.23.so',
                    'type': 'symbolic'
                },
                {
                    'id': u'e20a2268-5dc6-c165-b6aa-a12fa6765a6e',
                    'image_addr': '0x7f5140527000',
                    'image_size': 90112,
                    'name': u'/lib/x86_64-linux-gnu/libgcc_s.so.1',
                    'type': 'symbolic'
                },
                {
                    'id': u'81c893cb-9b92-3c52-01ac-ef171b52d526',
                    'image_addr': '0x7f514073d000',
                    'image_size': 1515520,
                    'name': u'/usr/lib/x86_64-linux-gnu/libstdc++.so.6.0.21',
                    'type': 'symbolic'
                },
                {
                    'id': u'23e017ce-2254-fc65-11d9-bc8f534bb4f0',
                    'image_addr': '0x7f5140abf000',
                    'image_size': 98304,
                    'name': u'/lib/x86_64-linux-gnu/libpthread-2.23.so',
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
                    'id': u'75185f6c-04b9-b48f-b8df-d832e74ad31a',
                    'image_addr': '0x7fff5aef1000',
                    'image_size': 8192,
                    'name': u'linux-gate.so',
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
                        'package': u'/work/linux/build/crash',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7f5140cdc000',
                        'package': None,
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x400040',
                        'package': u'/work/linux/build/crash',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7fff5aef1000',
                        'package': None,
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x401de9',
                        'package': u'/work/linux/build/crash',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x401dc0',
                        'package': u'/work/linux/build/crash',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x414ca0',
                        'package': u'/work/linux/build/crash',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x401c70',
                        'package': u'/work/linux/build/crash',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x401dc0',
                        'package': u'/work/linux/build/crash',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x401c70',
                        'package': u'/work/linux/build/crash',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7f514017d830',
                        'package': u'/lib/x86_64-linux-gnu/libc-2.23.so',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x414c30',
                        'package': u'/work/linux/build/crash',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x401ec0',
                        'package': u'/work/linux/build/crash',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7f5140cebac6',
                        'package': u'/lib/x86_64-linux-gnu/ld-2.23.so',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x400000',
                        'package': None,
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7f51401e4800',
                        'package': u'/lib/x86_64-linux-gnu/libc-2.23.so',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7f514025002e',
                        'package': u'/lib/x86_64-linux-gnu/libc-2.23.so',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x401d72',
                        'package': u'/work/linux/build/crash',
                        'trust': 'context',
                    }
                ],
                'registers': {
                    u'r10': u'0x0000000000000131',
                    u'r11': u'0x00007f5140aca4c0',
                    u'r12': u'0x0000000000401dc0',
                    u'r13': u'0x00007fff5ae4ac90',
                    u'r14': u'0x00007fff5ae4aab0',
                    u'r15': u'0x0000000000000000',
                    u'r8': u'0x0000000000000000',
                    u'r9': u'0x0000000000000000',
                    u'rax': u'0xffffffffffffffff',
                    u'rbp': u'0x00007fff5ae4abb0',
                    u'rbx': u'0x00007fff5ae4aa20',
                    u'rcx': u'0x00007f5140521b20',
                    u'rdi': u'0x00007fff5ae4aab0',
                    u'rdx': u'0x00007f5140efc000',
                    u'rip': u'0x0000000000401d72',
                    u'rsi': u'0x0000000000000000',
                    u'rsp': u'0x00007fff5ae4aa20'
                }
            },
            'thread_id': 1304,
            'type': u'SIGSEGV /0x00000000',
            'value': u'Fatal Error: SIGSEGV /0x00000000'
        },
        'level': 'fatal',
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
    with open(minidump, 'rb') as f:
        state = process_minidump(f.read())
        merge_process_state_event(event, state)

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
                    'id': u'36385a3a-60d3-32db-bf55-c6d8931a7aa6',
                    'image_addr': '0x7fffd229c000',
                    'image_size': 4800512,
                    'name': u'/System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation',
                    'type': 'symbolic'
                },
                {
                    'id': u'84a04d24-0e60-3810-a8c0-90a65e2df61a',
                    'image_addr': '0x7fffe668e000',
                    'image_size': 8192,
                    'name': u'/usr/lib/libDiagnosticMessagesClient.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'f18ac1e7-c6f1-34b1-8069-be571b3231d4',
                    'image_addr': '0x7fffe68cd000',
                    'image_size': 8192,
                    'name': u'/usr/lib/libSystem.B.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'0b43bb5d-e6eb-3464-8de9-b41ac8ed9d1c',
                    'image_addr': '0x7fffe6a80000',
                    'image_size': 356352,
                    'name': u'/usr/lib/libc++.1.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'bc271ad3-831b-362a-9da7-e8c51f285fe4',
                    'image_addr': '0x7fffe6ad7000',
                    'image_size': 172032,
                    'name': u'/usr/lib/libc++abi.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'ccd2ed24-3071-383b-925d-8d763bb12a6f',
                    'image_addr': '0x7fffe7041000',
                    'image_size': 2252800,
                    'name': u'/usr/lib/libicucore.A.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'4df3c25c-52c2-3f01-a3ef-0d9d53a73c1c',
                    'image_addr': '0x7fffe75f5000',
                    'image_size': 4022272,
                    'name': u'/usr/lib/libobjc.A.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'46e3ffa2-4328-327a-8d34-a03e20bffb8e',
                    'image_addr': '0x7fffe7def000',
                    'image_size': 73728,
                    'name': u'/usr/lib/libz.1.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'093a4dab-8385-3d47-a350-e20cb7ccf7bf',
                    'image_addr': '0x7fffe7e0f000',
                    'image_size': 20480,
                    'name': u'/usr/lib/system/libcache.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'8a64d1b0-c70e-385c-92f0-e669079fda90',
                    'image_addr': '0x7fffe7e14000',
                    'image_size': 45056,
                    'name': u'/usr/lib/system/libcommonCrypto.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'55d47421-772a-32ab-b529-1a46c2f43b4d',
                    'image_addr': '0x7fffe7e1f000',
                    'image_size': 32768,
                    'name': u'/usr/lib/system/libcompiler_rt.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'819bea3c-df11-3e3d-a1a1-5a51c5bf1961',
                    'image_addr': '0x7fffe7e27000',
                    'image_size': 36864,
                    'name': u'/usr/lib/system/libcopyfile.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'65d7165e-2e71-335d-a2d6-33f78e2df0c1',
                    'image_addr': '0x7fffe7e30000',
                    'image_size': 540672,
                    'name': u'/usr/lib/system/libcorecrypto.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'6582bad6-ed27-3b30-b620-90b1c5a4ae3c',
                    'image_addr': '0x7fffe7eb4000',
                    'image_size': 204800,
                    'name': u'/usr/lib/system/libdispatch.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'9b2ac56d-107c-3541-a127-9094a751f2c9',
                    'image_addr': '0x7fffe7ee6000',
                    'image_size': 24576,
                    'name': u'/usr/lib/system/libdyld.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'7aa011a9-dc21-3488-bf73-3b5b14d1fdd6',
                    'image_addr': '0x7fffe7eec000',
                    'image_size': 4096,
                    'name': u'/usr/lib/system/libkeymgr.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'b856abd2-896e-3de0-b2c8-146a6af8e2a7',
                    'image_addr': '0x7fffe7efa000',
                    'image_size': 4096,
                    'name': u'/usr/lib/system/liblaunch.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'17d5d855-f6c3-3b04-b680-e9bf02ef8aed',
                    'image_addr': '0x7fffe7efb000',
                    'image_size': 24576,
                    'name': u'/usr/lib/system/libmacho.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'12448cc2-378e-35f3-be33-9dc395a5b970',
                    'image_addr': '0x7fffe7f01000',
                    'image_size': 12288,
                    'name': u'/usr/lib/system/libquarantine.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'38d4cb9c-10cd-30d3-8b7b-a515ec75fe85',
                    'image_addr': '0x7fffe7f04000',
                    'image_size': 8192,
                    'name': u'/usr/lib/system/libremovefile.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'096e4228-3b7c-30a6-8b13-ec909a64499a',
                    'image_addr': '0x7fffe7f06000',
                    'image_size': 102400,
                    'name': u'/usr/lib/system/libsystem_asl.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'10dc5404-73ab-35b3-a277-a8afecb476eb',
                    'image_addr': '0x7fffe7f1f000',
                    'image_size': 4096,
                    'name': u'/usr/lib/system/libsystem_blocks.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'e5ae5244-7d0c-36ac-8bb6-c7ae7ea52a4b',
                    'image_addr': '0x7fffe7f20000',
                    'image_size': 581632,
                    'name': u'/usr/lib/system/libsystem_c.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'becc01a2-ca8d-31e6-bcdf-d452965fa976',
                    'image_addr': '0x7fffe7fae000',
                    'image_size': 16384,
                    'name': u'/usr/lib/system/libsystem_configuration.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'7d26de79-b424-3450-85e1-f7fab32714ab',
                    'image_addr': '0x7fffe7fb2000',
                    'image_size': 16384,
                    'name': u'/usr/lib/system/libsystem_coreservices.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'ec6fcf07-dcfb-3a03-9cc9-6dd3709974c6',
                    'image_addr': '0x7fffe7fb6000',
                    'image_size': 102400,
                    'name': u'/usr/lib/system/libsystem_coretls.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'cc960215-0b1b-3822-a13a-3dde96fa796f',
                    'image_addr': '0x7fffe7fcf000',
                    'image_size': 28672,
                    'name': u'/usr/lib/system/libsystem_dnssd.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'611db84c-bf70-3f92-8702-b9f28a900920',
                    'image_addr': '0x7fffe7fd6000',
                    'image_size': 172032,
                    'name': u'/usr/lib/system/libsystem_info.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'34b1f16c-bc9c-3c5f-9045-0cae91cb5914',
                    'image_addr': '0x7fffe8000000',
                    'image_size': 143360,
                    'name': u'/usr/lib/system/libsystem_kernel.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'86d499b5-bbdc-3d3b-8a4e-97ae8e6672a4',
                    'image_addr': '0x7fffe8023000',
                    'image_size': 294912,
                    'name': u'/usr/lib/system/libsystem_m.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'a3d15f17-99a6-3367-8c7e-4280e8619c95',
                    'image_addr': '0x7fffe806b000',
                    'image_size': 126976,
                    'name': u'/usr/lib/system/libsystem_malloc.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'369d0221-56ca-3c3e-9ede-94b41cae77b7',
                    'image_addr': '0x7fffe808a000',
                    'image_size': 368640,
                    'name': u'/usr/lib/system/libsystem_network.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'b021f2b3-8a75-3633-abb0-fc012b8e9b0c',
                    'image_addr': '0x7fffe80e4000',
                    'image_size': 40960,
                    'name': u'/usr/lib/system/libsystem_networkextension.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'b8160190-a069-3b3a-bdf6-2aa408221fae',
                    'image_addr': '0x7fffe80ee000',
                    'image_size': 40960,
                    'name': u'/usr/lib/system/libsystem_notify.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'897462fd-b318-321b-a554-e61982630f7e',
                    'image_addr': '0x7fffe80f8000',
                    'image_size': 36864,
                    'name': u'/usr/lib/system/libsystem_platform.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'b8fb5e20-3295-39e2-b5eb-b464d1d4b104',
                    'image_addr': '0x7fffe8101000',
                    'image_size': 45056,
                    'name': u'/usr/lib/system/libsystem_pthread.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'4b92ec49-acd0-36ae-b07a-a2b8152eaf9d',
                    'image_addr': '0x7fffe810c000',
                    'image_size': 16384,
                    'name': u'/usr/lib/system/libsystem_sandbox.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'f78b847b-3565-3e4b-98a6-f7ad40392e2d',
                    'image_addr': '0x7fffe8110000',
                    'image_size': 8192,
                    'name': u'/usr/lib/system/libsystem_secinit.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'3390e07c-c1ce-348f-adbd-2c5440b45eaa',
                    'image_addr': '0x7fffe8112000',
                    'image_size': 32768,
                    'name': u'/usr/lib/system/libsystem_symptoms.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'ac63a7fe-50d9-3a30-96e6-f6b7ff16e465',
                    'image_addr': '0x7fffe811a000',
                    'image_size': 81920,
                    'name': u'/usr/lib/system/libsystem_trace.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'3d50d8a8-c460-334d-a519-2da841102c6b',
                    'image_addr': '0x7fffe812e000',
                    'image_size': 24576,
                    'name': u'/usr/lib/system/libunwind.dylib',
                    'type': 'symbolic'
                },
                {
                    'id': u'bf896df0-d8e9-31a8-a4b3-01120bfeee52',
                    'image_addr': '0x7fffe8134000',
                    'image_size': 172032,
                    'name': u'/usr/lib/system/libxpc.dylib',
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
                        'package': u'/usr/lib/system/libdyld.dylib',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7fffe7eeb235',
                        'package': u'/usr/lib/system/libdyld.dylib',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x109ba8c70',
                        'package': u'/Users/travis/build/getsentry/breakpad-tools/macos/build/./crash',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x109ba8c15',
                        'package': u'/Users/travis/build/getsentry/breakpad-tools/macos/build/./crash',
                        'trust': 'context',
                    }
                ],
                'registers': {
                    u'r10': u'0x000000000000002e',
                    u'r11': u'0x00007fffe8105171',
                    u'r12': u'0x0000000000000000',
                    u'r13': u'0x0000000000000000',
                    u'r14': u'0x0000000000000000',
                    u'r15': u'0x0000000000000000',
                    u'r8': u'0x000000000c0008ff',
                    u'r9': u'0x0000000000000000',
                    u'rax': u'0x0000000000000001',
                    u'rbp': u'0x00007fff56064258',
                    u'rbx': u'0x00007fff56064120',
                    u'rcx': u'0x0000000000000000',
                    u'rdi': u'0x00007fff56064120',
                    u'rdx': u'0x0000000000000000',
                    u'rip': u'0x0000000109ba8c15',
                    u'rsi': u'0x00007fff56064140',
                    u'rsp': u'0x00007fff56064110'
                }
            },
            'thread_id': 775,
            'type': u'EXC_BAD_ACCESS / KERN_INVALID_ADDRESS',
            'value': u'Fatal Error: EXC_BAD_ACCESS / KERN_INVALID_ADDRESS'
        },
        'level': 'fatal',
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
    with open(minidump, 'rb') as f:
        state = process_minidump(f.read())
        merge_process_state_event(event, state)

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
                    'id': u'9c2a902b-6fdf-40ad-8308-588a41d572a0-1',
                    'image_addr': '0x70850000',
                    'image_size': 1331200,
                    'name': u'C:\\Windows\\System32\\dbghelp.dll',
                    'type': 'symbolic'
                },
                {
                    'id': u'bf5257f7-8c26-43dd-9bb7-901625e1136a-1',
                    'image_addr': '0x709a0000',
                    'image_size': 442368,
                    'name': u'C:\\Windows\\System32\\msvcp140.dll',
                    'type': 'symbolic'
                },
                {
                    'id': u'8daf7773-372f-460a-af38-944e193f7e33-1',
                    'image_addr': '0x70a10000',
                    'image_size': 598016,
                    'name': u'C:\\Windows\\System32\\apphelp.dll',
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
                    'id': u'0ed80a50-ecda-472b-86a4-eb6c833f8e1b-1',
                    'image_addr': '0x70c60000',
                    'image_size': 81920,
                    'name': u'C:\\Windows\\System32\\VCRUNTIME140.dll',
                    'type': 'symbolic'
                },
                {
                    'id': u'147c51fb-7ca1-408f-85b5-285f2ad6f9c5-1',
                    'image_addr': '0x73ba0000',
                    'image_size': 40960,
                    'name': u'C:\\Windows\\System32\\CRYPTBASE.dll',
                    'type': 'symbolic'
                },
                {
                    'id': u'51e432b1-0450-4b19-8ed1-6d4335f9f543-1',
                    'image_addr': '0x73bb0000',
                    'image_size': 126976,
                    'name': u'C:\\Windows\\System32\\sspicli.dll',
                    'type': 'symbolic'
                },
                {
                    'id': u'0c799483-b549-417d-8433-4331852031fe-1',
                    'image_addr': '0x73c70000',
                    'image_size': 487424,
                    'name': u'C:\\Windows\\System32\\advapi32.dll',
                    'type': 'symbolic'
                },
                {
                    'id': u'6f6409b3-d520-43c7-9b2f-62e00bfe761c-1',
                    'image_addr': '0x73cf0000',
                    'image_size': 778240,
                    'name': u'C:\\Windows\\System32\\msvcrt.dll',
                    'type': 'symbolic'
                },
                {
                    'id': u'6f6a05dd-0a80-478b-a419-9b88703bf75b-1',
                    'image_addr': '0x74450000',
                    'image_size': 266240,
                    'name': u'C:\\Windows\\System32\\sechost.dll',
                    'type': 'symbolic'
                },
                {
                    'id': u'd3474559-96f7-47d6-bf43-c176b2171e68-1',
                    'image_addr': '0x75050000',
                    'image_size': 917504,
                    'name': u'C:\\Windows\\System32\\kernel32.dll',
                    'type': 'symbolic'
                },
                {
                    'id': u'287b19c3-9209-4a2b-bb8f-bcc37f411b11-1',
                    'image_addr': '0x75130000',
                    'image_size': 368640,
                    'name': u'C:\\Windows\\System32\\bcryptPrimitives.dll',
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
                    'id': u'6bedcbce-0a3a-40e9-8040-81c2c8c6cc2f-1',
                    'image_addr': '0x758f0000',
                    'image_size': 917504,
                    'name': u'C:\\Windows\\System32\\ucrtbase.dll',
                    'type': 'symbolic'
                },
                {
                    'id': u'8462294a-c645-402d-ac82-a4e95f61ddf9-1',
                    'image_addr': '0x76db0000',
                    'image_size': 1708032,
                    'name': u'C:\\Windows\\System32\\KERNELBASE.dll',
                    'type': 'symbolic'
                },
                {
                    'id': u'971f98e5-ce60-41ff-b2d7-235bbeb34578-1',
                    'image_addr': '0x77170000',
                    'image_size': 1585152,
                    'name': u'C:\\Windows\\System32\\ntdll.dll',
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
                        'package': u'C:\\Windows\\System32\\ntdll.dll',
                        'trust': 'fp',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x771d0f79',
                        'package': u'C:\\Windows\\System32\\ntdll.dll',
                        'trust': 'fp',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x750662c4',
                        'package': u'C:\\Windows\\System32\\kernel32.dll',
                        'trust': 'fp',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x2a2d97',
                        'package': u'C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x2a3435',
                        'package': u'C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7584e9c0',
                        'package': u'C:\\Windows\\System32\\rpcrt4.dll',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x75810000',
                        'package': None,
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x70b7ae40',
                        'package': u'C:\\Windows\\System32\\dbgcore.dll',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x70850000',
                        'package': None,
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x7584e9c0',
                        'package': u'C:\\Windows\\System32\\rpcrt4.dll',
                        'trust': 'scan',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x2a28d0',
                        'package': u'C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe',
                        'trust': 'fp',
                    },
                    {
                        'function': '<unknown>',
                        'instruction_addr': '0x2a2a3d',
                        'package': u'C:\\projects\\breakpad-tools\\windows\\Release\\crash.exe',
                        'trust': 'context',
                    }
                ],
                'registers': {
                    u'eax': u'0x00000000',
                    u'ebp': u'0x010ff670',
                    u'ebx': u'0x00fe5000',
                    u'ecx': u'0x010ff670',
                    u'edi': u'0x013bfd78',
                    u'edx': u'0x00000007',
                    u'eflags': u'0x00010246',
                    u'eip': u'0x002a2a3d',
                    u'esi': u'0x759c6314',
                    u'esp': u'0x010ff644'
                }
            },
            'thread_id': 1636,
            'type': u'EXCEPTION_ACCESS_VIOLATION_WRITE',
            'value': u'Fatal Error: EXCEPTION_ACCESS_VIOLATION_WRITE'
        },
        'level': 'fatal',
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
                        'package': u'C:\\Windows\\System32\\ntdll.dll',
                        'trust': 'fp',
                    },
                        {
                        'function': '<unknown>',
                        'instruction_addr': '0x771d0f79',
                        'package': u'C:\\Windows\\System32\\ntdll.dll',
                        'trust': 'fp',
                    },
                        {
                        'function': '<unknown>',
                        'instruction_addr': '0x750662c4',
                        'package': u'C:\\Windows\\System32\\kernel32.dll',
                        'trust': 'fp',
                    },
                        {
                        'function': '<unknown>',
                        'instruction_addr': '0x771e016c',
                        'package': u'C:\\Windows\\System32\\ntdll.dll',
                        'trust': 'context',
                    }],
                    'registers': {
                        u'eax': u'0x00000000',
                        u'ebp': u'0x0159faa4',
                        u'ebx': u'0x013b0990',
                        u'ecx': u'0x00000000',
                        u'edi': u'0x013b4af0',
                        u'edx': u'0x00000000',
                        u'eflags': u'0x00000216',
                        u'eip': u'0x771e016c',
                        u'esi': u'0x013b4930',
                        u'esp': u'0x0159f900'
                    }
                }
            },
            {
                'crashed': False,
                'id': 2600,
                'stacktrace': {
                    'frames': [{
                        'function': '<unknown>',
                        'instruction_addr': '0x771d0f44',
                        'package': u'C:\\Windows\\System32\\ntdll.dll',
                        'trust': 'fp',
                    },
                        {
                        'function': '<unknown>',
                        'instruction_addr': '0x771d0f79',
                        'package': u'C:\\Windows\\System32\\ntdll.dll',
                        'trust': 'fp',
                    },
                        {
                        'function': '<unknown>',
                        'instruction_addr': '0x750662c4',
                        'package': u'C:\\Windows\\System32\\kernel32.dll',
                        'trust': 'fp',
                    },
                        {
                        'function': '<unknown>',
                        'instruction_addr': '0x771e016c',
                        'package': u'C:\\Windows\\System32\\ntdll.dll',
                        'trust': 'context',
                    }],
                    'registers': {
                        u'eax': u'0x00000000',
                        u'ebp': u'0x0169fb98',
                        u'ebx': u'0x013b0990',
                        u'ecx': u'0x00000000',
                        u'edi': u'0x013b7c28',
                        u'edx': u'0x00000000',
                        u'eflags': u'0x00000202',
                        u'eip': u'0x771e016c',
                        u'esi': u'0x013b7a68',
                        u'esp': u'0x0169f9f4'
                    }
                }
            },
            {
                'crashed': False,
                'id': 2920,
                'stacktrace': {
                    'frames': [{
                        'function': '<unknown>',
                        'instruction_addr': '0x771df3dc',
                        'package': u'C:\\Windows\\System32\\ntdll.dll',
                        'trust': 'context',
                    }],
                    'registers': {
                        u'eax': u'0x00000000',
                        u'ebp': u'0x0179f2b8',
                        u'ebx': u'0x017b1aa0',
                        u'ecx': u'0x00000000',
                        u'edi': u'0x017b1a90',
                        u'edx': u'0x00000000',
                        u'eflags': u'0x00000206',
                        u'eip': u'0x771df3dc',
                        u'esi': u'0x000002cc',
                        u'esp': u'0x0179f2ac'
                    }
                }
            }
        ],
        'timestamp': 1521713273.0
    }
