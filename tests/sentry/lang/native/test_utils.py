from __future__ import absolute_import

from sentry.lang.native.utils import get_sdk_from_event, _convert_debug_meta_to_binary_image_row, get_binary_images_apple_string


def test_get_sdk_from_event():
    sdk_info = get_sdk_from_event({
        'debug_meta': {
            'sdk_info': {
                'dsym_type': 'macho',
                'sdk_name': 'iOS',
                'version_major': 9,
                'version_minor': 3,
                'version_patchlevel': 0,
            }
        }
    })
    assert sdk_info['dsym_type'] == 'macho'
    assert sdk_info['sdk_name'] == 'iOS'
    assert sdk_info['version_major'] == 9
    assert sdk_info['version_minor'] == 3
    assert sdk_info['version_patchlevel'] == 0

    sdk_info = get_sdk_from_event({
        'contexts': {
            'os': {
                'type': 'os',
                'name': 'iOS',
                'version': '9.3.1.1234',
            }
        }
    })

    assert sdk_info['dsym_type'] == 'macho'
    assert sdk_info['sdk_name'] == 'iOS'
    assert sdk_info['version_major'] == 9
    assert sdk_info['version_minor'] == 3
    assert sdk_info['version_patchlevel'] == 1


def test_get_binary_images_apple_string():
    binary_images = get_binary_images_apple_string([
        {'cpu_subtype': 3,
        'cpu_type': 16777223,
        'image_addr': '0x141c5000',
        'image_size': 20480,
        'image_vmaddr': '0x0',
        'name': '/Users/haza/Library/Developer/CoreSimulator/Devices/DDB32F4C-97CF-4E2B-BD10-EB940553F223/data/Containers/Bundle/Application/8C286977-D498-44FF-B7BE-42BFE3DE38BD/SwiftExample.app/Frameworks/libswiftContacts.dylib',
        'type': 'apple',
        'uuid': '4B5A054F-B7A1-3AD0-81E1-513B4DBE2A33'},
        {'cpu_subtype': 3,
        'cpu_type': 16777223,
        'image_addr': '0x1400c000',
        'image_size': 266240,
        'image_vmaddr': '0x0',
        'name': '/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator.sdk/System/Library/PrivateFrameworks/ContentIndex.framework/ContentIndex',
        'type': 'apple',
        'uuid': '766DFB14-72EE-32D2-8961-687D32548F2B'},
        {'cpu_subtype': 3,
        'cpu_type': 16777223,
        'image_addr': '0x1406f000',
        'image_size': 913408,
        'image_vmaddr': '0x0',
        'name': '/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator.sdk/System/Library/PrivateFrameworks/CorePDF.framework/CorePDF',
        'type': 'apple',
        'uuid': 'BE602DC1-D3A0-3389-B8F4-922C37DEA3DC'}
    ], {
        'device': {
            'arch': 'x86',
            'family': 'iPhone',
            'freeMemory': 169684992,
            'memorySize': 17179869184,
            'model': 'iPhone9,1',
            'simulator': True,
            'storageSize': 249695305728,
            'type': 'device',
            'usableMemory': 14919622656
        },
        'os': {
            'build': '16C67',
            'bundleID': 'com.rokkincat.SentryExample',
            'bundleVersion': '2',
            'kernel_version': 'Darwin Kernel Version 16.3.0: Thu Nov 17 20:23:58 PST 2016; root:xnu-3789.31.2~1/RELEASE_X86_64',
            'name': 'iOS',
            'type': 'os',
            'version': '10.2'
        }
    })
    assert binary_images == 'Binary Images:\n\
0x1400c000 - 0x1404cfff ContentIndex x86  <766dfb1472ee32d28961687d32548f2b> /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator.sdk/System/Library/PrivateFrameworks/ContentIndex.framework/ContentIndex\n\
0x1406f000 - 0x1414dfff CorePDF x86  <be602dc1d3a03389b8f4922c37dea3dc> /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator.sdk/System/Library/PrivateFrameworks/CorePDF.framework/CorePDF\n\
0x141c5000 - 0x141c9fff libswiftContacts.dylib x86  <4b5a054fb7a13ad081e1513b4dbe2a33> /Users/haza/Library/Developer/CoreSimulator/Devices/DDB32F4C-97CF-4E2B-BD10-EB940553F223/data/Containers/Bundle/Application/8C286977-D498-44FF-B7BE-42BFE3DE38BD/SwiftExample.app/Frameworks/libswiftContacts.dylib'


def test_convert_debug_meta_to_binary_image_row():
    binary_image = _convert_debug_meta_to_binary_image_row({
        'cpu_subtype': 3,
        'cpu_type': 16777223,
        'image_addr': '0xd69a000',
        'image_size': 495616,
        'image_vmaddr': '0x0',
        'name': '/Users/haza/Library/Developer/CoreSimulator/Devices/DDB32F4C-97CF-4E2B-BD10-EB940553F223/data/Containers/Bundle/Application/8F8140DF-B25B-4088-B5FB-57F474A49CD6/SwiftExample.app/Frameworks/SentrySwift.framework/SentrySwift',
        'type': 'apple',
        'uuid': 'B427AE1D-BF36-3B50-936F-D78A7D1C8340'
    }, {'device':
        {'arch': 'x86',
         'family': 'iPhone',
         'freeMemory': 169684992,
         'memorySize': 17179869184,
         'model': 'iPhone9,1',
         'simulator': True,
         'storageSize': 249695305728,
         'type': 'device',
         'usableMemory': 14919622656
         },
    'os':
        {'build': '16C67',
         'bundleID': 'com.rokkincat.SentryExample',
         'bundleVersion': '2',
         'kernel_version': 'Darwin Kernel Version 16.3.0: Thu Nov 17 20:23:58 PST 2016; root:xnu-3789.31.2~1/RELEASE_X86_64',
         'name': 'iOS',
         'type': 'os',
         'version': '10.2'
         }
    })
    assert binary_image == '0xd69a000 - 0xd712fff SentrySwift x86  <b427ae1dbf363b50936fd78a7d1c8340> /Users/haza/Library/Developer/CoreSimulator/Devices/DDB32F4C-97CF-4E2B-BD10-EB940553F223/data/Containers/Bundle/Application/8F8140DF-B25B-4088-B5FB-57F474A49CD6/SwiftExample.app/Frameworks/SentrySwift.framework/SentrySwift'
