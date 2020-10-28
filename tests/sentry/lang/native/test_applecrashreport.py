from __future__ import absolute_import

from sentry.constants import NATIVE_UNKNOWN_STRING
from sentry.lang.native.applecrashreport import AppleCrashReport


def test_get_threads_apple_string():
    acr = AppleCrashReport(
        threads=[
            {
                "crashed": True,
                "current": True,
                "id": 1,
                "name": None,
                "stacktrace": {
                    "frames": [
                        {
                            "abs_path": "/Users/haza/Projects/sentry-swift/Sources/ios/SentrySwizzle.swift",
                            "colno": 0,
                            "filename": "SentrySwizzle.swift",
                            "function": "@objc UIApplication.sentryClient_sendAction(Selector, to : AnyObject?, from : AnyObject?, for : UIEvent?) -> Bool",
                            "image_addr": "0x2c8000",
                            "in_app": False,
                            "instruction_addr": "0x31caa4",
                            "lineno": 0,
                            "object_addr": "0x2c8000",
                            "package": "/private/var/containers/Bundle/Application/06EA18D0-49C5-452C-B431-92B1098FB4AD/SwiftExample.app/Frameworks/SentrySwift.framework/SentrySwift",
                            "symbol": "_TToFE11SentrySwiftCSo13UIApplication23sentryClient_sendActionfTV10ObjectiveC8Selector2toGSqPs9AnyObject__4fromGSqPS3___3forGSqCSo7UIEvent__Sb",
                            "symbol_addr": "0x31ca38",
                        },
                        {
                            "abs_path": "/Users/haza/Projects/sentry-swift/Sources/ios/SentrySwizzle.swift",
                            "colno": 84,
                            "filename": "SentrySwizzle.swift",
                            "function": "UIApplication.sentryClient_sendAction(Selector, to : AnyObject?, from : AnyObject?, for : UIEvent?) -> Bool",
                            "image_addr": "0x2c8000",
                            "in_app": False,
                            "instruction_addr": "0x31c3e8",
                            "lineno": 92,
                            "object_addr": "0x2c8000",
                            "package": "/private/var/containers/Bundle/Application/06EA18D0-49C5-452C-B431-92B1098FB4AD/SwiftExample.app/Frameworks/SentrySwift.framework/SentrySwift",
                            "symbol": "_TFE11SentrySwiftCSo13UIApplication23sentryClient_sendActionfTV10ObjectiveC8Selector2toGSqPs9AnyObject__4fromGSqPS3___3forGSqCSo7UIEvent__Sb",
                            "symbol_addr": "0x31b9f8",
                        },
                    ]
                },
            },
            {
                "crashed": False,
                "current": False,
                "id": 2,
                "name": "com.apple.test",
                "stacktrace": {
                    "frames": [
                        {
                            "abs_path": "/Users/haza/Projects/sentry-swift/Examples/SwiftExample/SwiftExample/ViewController.swift",
                            "colno": 0,
                            "filename": "ViewController.swift",
                            "function": "@objc ViewController.onClickFatalError(AnyObject) -> ()",
                            "image_addr": "0xf0000",
                            "in_app": True,
                            "instruction_addr": "0xf6cd4",
                            "lineno": 0,
                            "object_addr": "0xf0000",
                            "package": "/var/containers/Bundle/Application/06EA18D0-49C5-452C-B431-92B1098FB4AD/SwiftExample.app/SwiftExample",
                            "symbol": "_TToFC12SwiftExample14ViewController17onClickFatalErrorfPs9AnyObject_T_",
                            "symbol_addr": "0xf6c98",
                        },
                        {
                            "abs_path": "/Users/haza/Projects/sentry-swift/Examples/SwiftExample/SwiftExample/ViewController.swift",
                            "colno": 36,
                            "filename": "ViewController.swift",
                            "function": "ViewController.onClickFatalError(AnyObject) -> ()",
                            "image_addr": "0xf0000",
                            "in_app": True,
                            "instruction_addr": "0xf6c78",
                            "lineno": 110,
                            "object_addr": "0xf0000",
                            "package": "/var/containers/Bundle/Application/06EA18D0-49C5-452C-B431-92B1098FB4AD/SwiftExample.app/SwiftExample",
                            "symbol": "_TFC12SwiftExample14ViewController17onClickFatalErrorfPs9AnyObject_T_",
                            "symbol_addr": "0xf6c04",
                        },
                    ]
                },
            },
        ]
    )
    threads = acr.get_threads_apple_string()
    assert (
        threads
        == "Thread 1 Crashed:\n\
0   SentrySwift                     0x31c3e8            0x2c8000 + 2544\n\
1   SentrySwift                     0x31caa4            0x2c8000 + 108\n\n\
Thread 2 name: com.apple.test\n\
0   SwiftExample                    0xf6c78             0xf0000 + 116\n\
1   SwiftExample                    0xf6cd4             0xf0000 + 60"
    )


def test_get_threads_apple_string_symbolicated():
    acr = AppleCrashReport(
        symbolicated=True,
        threads=[
            {
                "crashed": True,
                "current": True,
                "id": 1,
                "name": None,
                "stacktrace": {
                    "frames": [
                        {
                            "abs_path": "/Users/haza/Projects/sentry-swift/Sources/ios/SentrySwizzle.swift",
                            "colno": 0,
                            "filename": "SentrySwizzle.swift",
                            "function": "@objc UIApplication.sentryClient_sendAction(Selector, to : AnyObject?, from : AnyObject?, for : UIEvent?) -> Bool",
                            "image_addr": "0x2c8000",
                            "in_app": False,
                            "instruction_addr": "0x31caa4",
                            "lineno": 0,
                            "object_addr": "0x2c8000",
                            "package": "/private/var/containers/Bundle/Application/06EA18D0-49C5-452C-B431-92B1098FB4AD/SwiftExample.app/Frameworks/SentrySwift.framework/SentrySwift",
                            "symbol": "_TToFE11SentrySwiftCSo13UIApplication23sentryClient_sendActionfTV10ObjectiveC8Selector2toGSqPs9AnyObject__4fromGSqPS3___3forGSqCSo7UIEvent__Sb",
                            "symbol_addr": "0x31ca38",
                        },
                        {
                            "abs_path": "/Users/haza/Projects/sentry-swift/Sources/ios/SentrySwizzle.swift",
                            "colno": 84,
                            "filename": "SentrySwizzle.swift",
                            "function": "UIApplication.sentryClient_sendAction(Selector, to : AnyObject?, from : AnyObject?, for : UIEvent?) -> Bool",
                            "image_addr": "0x2c8000",
                            "in_app": False,
                            "instruction_addr": "0x31c3e8",
                            "lineno": 92,
                            "object_addr": "0x2c8000",
                            "package": "/private/var/containers/Bundle/Application/06EA18D0-49C5-452C-B431-92B1098FB4AD/SwiftExample.app/Frameworks/SentrySwift.framework/SentrySwift",
                            "symbol": "_TFE11SentrySwiftCSo13UIApplication23sentryClient_sendActionfTV10ObjectiveC8Selector2toGSqPs9AnyObject__4fromGSqPS3___3forGSqCSo7UIEvent__Sb",
                            "symbol_addr": "0x31b9f8",
                        },
                    ]
                },
            },
            {
                "crashed": False,
                "current": False,
                "id": 2,
                "name": "com.apple.test",
                "stacktrace": {
                    "frames": [
                        {
                            "abs_path": "/Users/haza/Projects/sentry-swift/Examples/SwiftExample/SwiftExample/ViewController.swift",
                            "colno": 0,
                            "filename": "ViewController.swift",
                            "function": "@objc ViewController.onClickFatalError(AnyObject) -> ()",
                            "image_addr": "0xf0000",
                            "in_app": True,
                            "instruction_addr": "0xf6cd4",
                            "lineno": 0,
                            "object_addr": "0xf0000",
                            "package": "/var/containers/Bundle/Application/06EA18D0-49C5-452C-B431-92B1098FB4AD/SwiftExample.app/SwiftExample",
                            "symbol": "_TToFC12SwiftExample14ViewController17onClickFatalErrorfPs9AnyObject_T_",
                            "symbol_addr": "0xf6c98",
                        },
                        {
                            "colno": 36,
                            "image_addr": "0xf0000",
                            "in_app": True,
                            "instruction_addr": "0xf6c78",
                            "lineno": 110,
                            "object_addr": "0xf0000",
                            "symbol_addr": "0xf6c04",
                        },
                    ]
                },
            },
        ],
    )
    threads = acr.get_threads_apple_string()
    assert (
        threads.rstrip()
        == """\
Thread 1 Crashed:\n\
0   SentrySwift                     0x31c3e8            UIApplication.sentryClient_sendAction(Selector, to : AnyObject?, from : AnyObject?, for : UIEvent?) -> Bool (SentrySwizzle.swift:92)
1   SentrySwift                     0x31caa4            @objc UIApplication.sentryClient_sendAction(Selector, to : AnyObject?, from : AnyObject?, for : UIEvent?) -> Bool

Thread 2 name: com.apple.test
0   <unknown>                       0xf6c78             <unknown> + 116
1   SwiftExample                    0xf6cd4             @objc ViewController.onClickFatalError(AnyObject) -> ()"""
    )


# 0   libswiftCore.dylib              0x0000000100556cc4 0x1003f8000 + 1436868
# 1   libswiftCore.dylib              0x0000000100556cc4 0x1003f8000 + 1436868
# 2   SentrySwift                     0x0000000100312308 @objc SentryClient.crash() -> () (Sentry.swift:0)
# 3   SwiftExample                    0x00000001000f6c78 ViewController.onClickFatalError(AnyObject) -> () (ViewController.swift:110)
# 4   SwiftExample                    0x00000001000f6cd4 @objc ViewController.onClickFatalError(AnyObject) -> () (ViewController.swift:0)
# 5   UIKit                           0x000000018755fd30 -[UIApplication sendAction:to:from:forEvent:] + 96
# 6   SentrySwift                     0x000000010031c3e8 UIApplication.sentryClient_sendAction(Selector, to : AnyObject?, from : AnyObject?, for : UIEvent?) -> Bool (SentrySwizzle.swift:92)
# 7   SentrySwift                     0x000000010031caa4 @objc
# UIApplication.sentryClient_sendAction(Selector, to : AnyObject?, from :
# AnyObject?, for : UIEvent?) -> Bool (SentrySwizzle.swift:0)

# 0   libswiftCore.dylib              0x0000000100556cc4 0x1003f8000 + 1436868
# 1   libswiftCore.dylib              0x0000000100556cc4 0x1003f8000 + 1436868
# 2   SentrySwift                     0x0000000100312308 0x1002c8000 + 303880
# 3   SwiftExample                    0x00000001000f6c78 0x1000f0000 + 27768
# 4   SwiftExample                    0x00000001000f6cd4 0x1000f0000 + 27860
# 5   UIKit                           0x000000018755fd30 0x18751b000 + 281904
# 6   SentrySwift                     0x000000010031c3e8 0x1002c8000 + 345064
# 7   SentrySwift                     0x000000010031caa4 0x1002c8000 + 346788


def test_get_thread_apple_string():
    acr = AppleCrashReport()
    thread = acr.get_thread_apple_string(
        {
            "crashed": True,
            "current": False,
            "id": 1,
            "name": None,
            "stacktrace": {
                "frames": [
                    {
                        "abs_path": "/Users/haza/Projects/sentry-swift/Sources/ios/SentrySwizzle.swift",
                        "colno": 0,
                        "filename": "SentrySwizzle.swift",
                        "function": "@objc UIApplication.sentryClient_sendAction(Selector, to : AnyObject?, from : AnyObject?, for : UIEvent?) -> Bool",
                        "image_addr": "0x2c8000",
                        "in_app": False,
                        "instruction_addr": "0x31caa4",
                        "lineno": 0,
                        "object_addr": "0x2c8000",
                        "package": "/private/var/containers/Bundle/Application/06EA18D0-49C5-452C-B431-92B1098FB4AD/SwiftExample.app/Frameworks/SentrySwift.framework/SentrySwift",
                        "symbol": "_TToFE11SentrySwiftCSo13UIApplication23sentryClient_sendActionfTV10ObjectiveC8Selector2toGSqPs9AnyObject__4fromGSqPS3___3forGSqCSo7UIEvent__Sb",
                        "symbol_addr": "0x31ca38",
                    },
                    {
                        "abs_path": "/Users/haza/Projects/sentry-swift/Sources/ios/SentrySwizzle.swift",
                        "colno": 84,
                        "filename": "SentrySwizzle.swift",
                        "function": "UIApplication.sentryClient_sendAction(Selector, to : AnyObject?, from : AnyObject?, for : UIEvent?) -> Bool",
                        "image_addr": "0x2c8000",
                        "in_app": False,
                        "instruction_addr": "0x31c3e8",
                        "lineno": 92,
                        "object_addr": "0x2c8000",
                        "package": "/private/var/containers/Bundle/Application/06EA18D0-49C5-452C-B431-92B1098FB4AD/SwiftExample.app/Frameworks/SentrySwift.framework/SentrySwift",
                        "symbol": "_TFE11SentrySwiftCSo13UIApplication23sentryClient_sendActionfTV10ObjectiveC8Selector2toGSqPs9AnyObject__4fromGSqPS3___3forGSqCSo7UIEvent__Sb",
                        "symbol_addr": "0x31b9f8",
                    },
                    {
                        "function": "<redacted>",
                        "image_addr": "0x8751b000",
                        "in_app": False,
                        "instruction_addr": "0x8755fd30",
                        "package": "/System/Library/Frameworks/UIKit.framework/UIKit",
                        "symbol_addr": "0x8755fcd0",
                    },
                    {
                        "abs_path": "/Users/haza/Projects/sentry-swift/Examples/SwiftExample/SwiftExample/ViewController.swift",
                        "colno": 0,
                        "filename": "ViewController.swift",
                        "function": "@objc ViewController.onClickFatalError(AnyObject) -> ()",
                        "image_addr": "0xf0000",
                        "in_app": True,
                        "instruction_addr": "0xf6cd4",
                        "lineno": 0,
                        "object_addr": "0xf0000",
                        "package": "/var/containers/Bundle/Application/06EA18D0-49C5-452C-B431-92B1098FB4AD/SwiftExample.app/SwiftExample",
                        "symbol": "_TToFC12SwiftExample14ViewController17onClickFatalErrorfPs9AnyObject_T_",
                        "symbol_addr": "0xf6c98",
                    },
                    {
                        "abs_path": "/Users/haza/Projects/sentry-swift/Examples/SwiftExample/SwiftExample/ViewController.swift",
                        "colno": 36,
                        "filename": "ViewController.swift",
                        "function": "ViewController.onClickFatalError(AnyObject) -> ()",
                        "image_addr": "0xf0000",
                        "in_app": True,
                        "instruction_addr": "0xf6c78",
                        "lineno": 110,
                        "object_addr": "0xf0000",
                        "package": "/var/containers/Bundle/Application/06EA18D0-49C5-452C-B431-92B1098FB4AD/SwiftExample.app/SwiftExample",
                        "symbol": "_TFC12SwiftExample14ViewController17onClickFatalErrorfPs9AnyObject_T_",
                        "symbol_addr": "0xf6c04",
                    },
                    {
                        "abs_path": "/Users/haza/Projects/sentry-swift/Sources/Sentry.swift",
                        "colno": 0,
                        "filename": "Sentry.swift",
                        "function": "@objc SentryClient.crash() -> ()",
                        "image_addr": "0x2c8000",
                        "in_app": False,
                        "instruction_addr": "0x312308",
                        "lineno": 0,
                        "object_addr": "0x2c8000",
                        "package": "/private/var/containers/Bundle/Application/06EA18D0-49C5-452C-B431-92B1098FB4AD/SwiftExample.app/Frameworks/SentrySwift.framework/SentrySwift",
                        "symbol": "_TToFC11SentrySwift12SentryClient5crashfT_T_",
                        "symbol_addr": "0x312280",
                    },
                    {
                        "function": "specialized _assertionFailed(StaticString, String, StaticString, UInt) -> ()",
                        "image_addr": "0x3f8000",
                        "in_app": False,
                        "instruction_addr": "0x556cc4",
                        "package": "/private/var/containers/Bundle/Application/06EA18D0-49C5-452C-B431-92B1098FB4AD/SwiftExample.app/Frameworks/libswiftCore.dylib",
                        "symbol_addr": "0x556c24",
                    },
                    {
                        "function": "specialized _assertionFailed(StaticString, String, StaticString, UInt) -> ()",
                        "image_addr": "0x3f8000",
                        "in_app": False,
                        "instruction_addr": "0x556cc4",
                        "package": "/private/var/containers/Bundle/Application/06EA18D0-49C5-452C-B431-92B1098FB4AD/SwiftExample.app/Frameworks/libswiftCore.dylib",
                        "symbol_addr": "0x556c24",
                    },
                ]
            },
        }
    )
    # TODO(hazat): the address here in a real crash is 0x0000000100556cc4 but we just get 0x556cc4
    assert (
        thread
        == "Thread 1 Crashed:\n\
0   libswiftCore.dylib              0x556cc4            0x3f8000 + 160\n\
1   libswiftCore.dylib              0x556cc4            0x3f8000 + 160\n\
2   SentrySwift                     0x312308            0x2c8000 + 136\n\
3   SwiftExample                    0xf6c78             0xf0000 + 116\n\
4   SwiftExample                    0xf6cd4             0xf0000 + 60\n\
5   UIKit                           0x8755fd30          0x8751b000 + 96\n\
6   SentrySwift                     0x31c3e8            0x2c8000 + 2544\n\
7   SentrySwift                     0x31caa4            0x2c8000 + 108"
    )


def test__convert_frame_to_apple_string():
    acr = AppleCrashReport()
    frame = acr._convert_frame_to_apple_string(
        frame={
            "abs_path": None,
            "colno": 0,
            "function": "SentryClient.crash() -> ()",
            "image_addr": "0xabd7000",
            "in_app": False,
            "instruction_addr": "0xac24ab6",
            "lineno": 0,
            "package": "/Users/haza/Library/Developer/CoreSimulator/Devices/DDB32F4C-97CF-4E2B-BD10-EB940553F223/data/Containers/Bundle/Application/4C903BE8-ED5E-414A-AC42-2D4ACCACE781/SwiftExample.app/Frameworks/SentrySwift.framework/SentrySwift",
            "symbol": "_TFC11SentrySwift12SentryClient5crashfT_T_",
            "symbol_addr": "0xac24a10",
        }
    )
    assert frame == "0   SentrySwift                     0xac24ab6           0xabd7000 + 166"
    acr2 = AppleCrashReport(symbolicated=True)
    frame_symbolicated = acr2._convert_frame_to_apple_string(
        frame={
            "abs_path": None,
            "colno": 0,
            "function": "SentryClient.crash() -> ()",
            "image_addr": "0xabd7000",
            "in_app": False,
            "instruction_addr": "0xac24ab6",
            "lineno": 0,
            "package": "/Users/haza/Library/Developer/CoreSimulator/Devices/DDB32F4C-97CF-4E2B-BD10-EB940553F223/data/Containers/Bundle/Application/4C903BE8-ED5E-414A-AC42-2D4ACCACE781/SwiftExample.app/Frameworks/SentrySwift.framework/SentrySwift",
            "symbol": "_TFC11SentrySwift12SentryClient5crashfT_T_",
            "symbol_addr": "0xac24a10",
        },
        number=1,
    )
    assert (
        frame_symbolicated
        == "1   SentrySwift                     0xac24ab6           SentryClient.crash() -> ()"
    )


def test_get_binary_images_apple_string():
    acr = AppleCrashReport(
        debug_images=[
            {
                "image_addr": "0x141c5000",
                "image_size": 20480,
                "image_vmaddr": "0x0",
                "code_file": "/Users/haza/Library/Developer/CoreSimulator/Devices/DDB32F4C-97CF-4E2B-BD10-EB940553F223/data/Containers/Bundle/Application/8C286977-D498-44FF-B7BE-42BFE3DE38BD/SwiftExample.app/Frameworks/libswiftContacts.dylib",
                "type": "native",
                "debug_id": "4B5A054F-B7A1-3AD0-81E1-513B4DBE2A33",
            },
            {
                "image_addr": "0x1400c000",
                "image_size": 266240,
                "image_vmaddr": "0x0",
                "code_file": "/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator.sdk/System/Library/PrivateFrameworks/ContentIndex.framework/ContentIndex",
                "type": "native",
                "debug_id": "766DFB14-72EE-32D2-8961-687D32548F2B",
            },
            {
                "image_addr": "0x1406f000",
                "image_size": 913408,
                # image_vmaddr defaults to 0x0
                "code_file": "/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator.sdk/System/Library/PrivateFrameworks/CorePDF.framework/CorePDF",
                "type": "native",
                "debug_id": "BE602DC1-D3A0-3389-B8F4-922C37DEA3DC",
            },
        ],
        context={
            "device": {
                "arch": "x86",
                "family": "iPhone",
                "freeMemory": 169684992,
                "memorySize": 17179869184,
                "model": "iPhone9,1",
                "simulator": True,
                "storageSize": 249695305728,
                "type": "device",
                "usableMemory": 14919622656,
            },
            "os": {
                "build": "16C67",
                "bundleID": "com.rokkincat.SentryExample",
                "bundleVersion": "2",
                "kernel_version": "Darwin Kernel Version 16.3.0: Thu Nov 17 20:23:58 PST 2016; root:xnu-3789.31.2~1/RELEASE_X86_64",
                "name": "iOS",
                "type": "os",
                "version": "10.2",
            },
        },
    )
    binary_images = acr.get_binary_images_apple_string()
    assert (
        binary_images
        == "Binary Images:\n\
0x1400c000 - 0x1404cfff ContentIndex x86  <766dfb1472ee32d28961687d32548f2b> /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator.sdk/System/Library/PrivateFrameworks/ContentIndex.framework/ContentIndex\n\
0x1406f000 - 0x1414dfff CorePDF x86  <be602dc1d3a03389b8f4922c37dea3dc> /Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/SDKs/iPhoneSimulator.sdk/System/Library/PrivateFrameworks/CorePDF.framework/CorePDF\n\
0x141c5000 - 0x141c9fff libswiftContacts.dylib x86  <4b5a054fb7a13ad081e1513b4dbe2a33> /Users/haza/Library/Developer/CoreSimulator/Devices/DDB32F4C-97CF-4E2B-BD10-EB940553F223/data/Containers/Bundle/Application/8C286977-D498-44FF-B7BE-42BFE3DE38BD/SwiftExample.app/Frameworks/libswiftContacts.dylib"
    )


def test_binary_images_without_code_file():
    acr = AppleCrashReport(
        debug_images=[
            {
                "image_addr": "0x141c5000",
                "image_size": 20480,
                "image_vmaddr": "0x0",
                "type": "native",
                "debug_id": "4B5A054F-B7A1-3AD0-81E1-513B4DBE2A33",
            },
            {
                "image_addr": "0x1400c000",
                "image_size": 266240,
                "image_vmaddr": "0x0",
                "type": "native",
                "debug_id": "766DFB14-72EE-32D2-8961-687D32548F2B",
            },
            {
                "image_addr": "0x1406f000",
                "image_size": 913408,
                # image_vmaddr defaults to 0x0
                "type": "native",
                "debug_id": "BE602DC1-D3A0-3389-B8F4-922C37DEA3DC",
            },
        ],
        context={
            "device": {
                "arch": "x86",
                "family": "iPhone",
                "freeMemory": 169684992,
                "memorySize": 17179869184,
                "model": "iPhone9,1",
                "simulator": True,
                "storageSize": 249695305728,
                "type": "device",
                "usableMemory": 14919622656,
            },
            "os": {
                "build": "16C67",
                "bundleID": "com.rokkincat.SentryExample",
                "bundleVersion": "2",
                "kernel_version": "Darwin Kernel Version 16.3.0: Thu Nov 17 20:23:58 PST 2016; root:xnu-3789.31.2~1/RELEASE_X86_64",
                "name": "iOS",
                "type": "os",
                "version": "10.2",
            },
        },
    )
    binary_images = acr.get_binary_images_apple_string()
    assert (
        binary_images
        == "Binary Images:\n\
0x1400c000 - 0x1404cfff {0} x86  <766dfb1472ee32d28961687d32548f2b> {0}\n\
0x1406f000 - 0x1414dfff {0} x86  <be602dc1d3a03389b8f4922c37dea3dc> {0}\n\
0x141c5000 - 0x141c9fff {0} x86  <4b5a054fb7a13ad081e1513b4dbe2a33> {0}".format(
            NATIVE_UNKNOWN_STRING
        )
    )


def test__convert_debug_meta_to_binary_image_row():
    acr = AppleCrashReport(
        context={
            "device": {
                "arch": "x86",
                "family": "iPhone",
                "freeMemory": 169684992,
                "memorySize": 17179869184,
                "model": "iPhone9,1",
                "simulator": True,
                "storageSize": 249695305728,
                "type": "device",
                "usableMemory": 14919622656,
            },
            "os": {
                "build": "16C67",
                "bundleID": "com.rokkincat.SentryExample",
                "bundleVersion": "2",
                "kernel_version": "Darwin Kernel Version 16.3.0: Thu Nov 17 20:23:58 PST 2016; root:xnu-3789.31.2~1/RELEASE_X86_64",
                "name": "iOS",
                "type": "os",
                "version": "10.2",
            },
        }
    )
    binary_image = acr._convert_debug_meta_to_binary_image_row(
        debug_image={
            "cpu_subtype": 3,
            "cpu_type": 16777223,
            "image_addr": "0xd69a000",
            "image_size": 495616,
            "image_vmaddr": "0x0",
            "code_file": "/Users/haza/Library/Developer/CoreSimulator/Devices/DDB32F4C-97CF-4E2B-BD10-EB940553F223/data/Containers/Bundle/Application/8F8140DF-B25B-4088-B5FB-57F474A49CD6/SwiftExample.app/Frameworks/SentrySwift.framework/SentrySwift",
            "type": "apple",
            "debug_id": "B427AE1D-BF36-3B50-936F-D78A7D1C8340",
        }
    )
    assert (
        binary_image
        == "0xd69a000 - 0xd712fff SentrySwift x86  <b427ae1dbf363b50936fd78a7d1c8340> /Users/haza/Library/Developer/CoreSimulator/Devices/DDB32F4C-97CF-4E2B-BD10-EB940553F223/data/Containers/Bundle/Application/8F8140DF-B25B-4088-B5FB-57F474A49CD6/SwiftExample.app/Frameworks/SentrySwift.framework/SentrySwift"
    )


def test__get_exception_info():
    acr = AppleCrashReport(
        exceptions=[
            {
                "value": "Attempted to dereference garbage pointer 0x10.",
                "mechanism": {
                    "type": "mach",
                    "data": {"relevant_address": "0x10"},
                    "meta": {
                        "signal": {
                            "number": 10,
                            "code": 0,
                            "name": "SIGBUS",
                            "code_name": "BUS_NOOP",
                        },
                        "mach_exception": {
                            "exception": 1,
                            "name": "EXC_BAD_ACCESS",
                            "subcode": 8,
                            "code": 16,
                        },
                    },
                },
                "type": "EXC_BAD_ACCESS",
                "thread_id": 0,
            }
        ]
    )
    exception_info = acr._get_exception_info()
    assert (
        exception_info
        == "Exception Type: EXC_BAD_ACCESS (SIGBUS)\n\
Exception Codes: BUS_NOOP at 0x10\n\
Crashed Thread: 0\n\n\
Application Specific Information:\n\
Attempted to dereference garbage pointer 0x10."
    )


def test__get_exception_info_legacy_mechanism():
    acr = AppleCrashReport(
        exceptions=[
            {
                "value": "Attempted to dereference garbage pointer 0x10.",
                "mechanism": {
                    "posix_signal": {
                        "name": "SIGBUS",
                        "code_name": "BUS_NOOP",
                        "signal": 10,
                        "code": 0,
                    },
                    "relevant_address": "0x10",
                    "mach_exception": {
                        "exception": 1,
                        "exception_name": "EXC_BAD_ACCESS",
                        "subcode": 8,
                        "code": 16,
                    },
                },
                "type": "EXC_BAD_ACCESS",
                "thread_id": 0,
            }
        ]
    )
    exception_info = acr._get_exception_info()
    assert (
        exception_info
        == "Exception Type: EXC_BAD_ACCESS (SIGBUS)\n\
Exception Codes: BUS_NOOP at 0x10\n\
Crashed Thread: 0\n\n\
Application Specific Information:\n\
Attempted to dereference garbage pointer 0x10."
    )


def test__get_exception_info_partial():
    acr = AppleCrashReport(
        exceptions=[
            {
                "value": "Attempted to dereference garbage pointer 0x10.",
                "type": "EXC_BAD_ACCESS",
                "thread_id": 0,
            }
        ]
    )
    exception_info = acr._get_exception_info()
    assert (
        exception_info
        == "\
Crashed Thread: 0\n\n\
Application Specific Information:\n\
Attempted to dereference garbage pointer 0x10."
    )
