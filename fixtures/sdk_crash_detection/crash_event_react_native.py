import time
from collections.abc import Mapping, MutableMapping, Sequence


def get_frames(filename: str) -> Sequence[MutableMapping[str, str]]:
    frames = [
        {
            "function": "dispatchEvent",
            "filename": "/Users/sentry.user/git-repos/sentry-react-native/samples/react-native/node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js",
            "abs_path": "/Users/sentry.user/git-repos/sentry-react-native/samples/react-native/node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js",
        },
        {
            "function": "Button.props.onPress",
            "filename": "/Users/sentry.user/git-repos/sentry-react-native/samples/react-native/src/Screens/HomeScreen.tsx",
            "abs_path": "/Users/sentry.user/git-repos/sentry-react-native/samples/react-native/src/Screens/HomeScreen.tsx",
        },
        {
            "function": "community.lib.dosomething",
            "filename": "/Users/sentry.user/git-repos/sentry-react-native/samples/react-native/node_modules/react-native-community/Renderer/implementations/ReactFabric-dev.js",
            "abs_path": "/Users/sentry.user/git-repos/sentry-react-native/samples/react-native/node_modules/react-native-community/Renderer/implementations/ReactFabric-dev.js",
        },
        {
            "function": "nativeCrash",
            "filename": "/Users/sentry.user/git-repos/sentry-react-native/dist/js/sdk.js",
            "abs_path": "/Users/sentry.user/git-repos/sentry-react-native/dist/js/sdk.js",
        },
        {
            "function": "ReactNativeClient#nativeCrash",
            "module": filename.replace("node_modules/", "").replace(".js", ""),
            "filename": filename,
            "abs_path": f"app:///{filename}",
        },
        {
            "function": "callFunctionReturnFlushedQueue",
            "module": "react-native/Libraries/BatchedBridge/MessageQueue",
            "filename": "node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
            "abs_path": "app:///node_modules/react-native/Libraries/BatchedBridge/MessageQueue.js",
        },
        {
            "function": "processCallbacks",
            "module": "react-native-community/BatchedBridge/MessageQueue",
            "filename": "node_modules/react-native-community/BatchedBridge/MessageQueue.js",
            "abs_path": "app:///node_modules/react-native-community/BatchedBridge/MessageQueue.js",
        },
    ]
    return frames


def get_exception(
    frames: Sequence[Mapping[str, str]],
    mechanism_type: str = "onerror",
) -> dict[str, object]:
    return {
        "type": "Error",
        "value": "Uncaught Thrown Error",
        "stacktrace": {"frames": frames},
        "mechanism": {"type": mechanism_type, "handled": False},
    }


def get_crash_event(
    filename="/Users/sentry.user/git-repos/sentry-react-native/dist/js/client.js", **kwargs
) -> dict[str, object]:
    return get_crash_event_with_frames(get_frames(filename=filename), **kwargs)


def get_crash_event_with_frames(frames: Sequence[Mapping[str, str]], **kwargs) -> dict[str, object]:
    result = {
        "event_id": "150d5b0b4f3a4797a3cd1345374ac484",
        "release": "com.samplenewarchitecture@1.0+1",
        "dist": "1",
        "platform": "javascript",
        "message": "",
        "environment": "dev",
        "exception": {"values": [get_exception(frames)]},
        "key_id": "3554525",
        "level": "fatal",
        "contexts": {
            "app": {
                "app_start_time": "2024-01-11T10:30:29.281Z",
                "app_identifier": "com.samplenewarchitecture",
                "app_name": "sampleNewArchitecture",
                "app_version": "1.0",
                "app_build": "1",
                "in_foreground": True,
                "view_names": ["Home"],
                "permissions": {
                    "ACCESS_NETWORK_STATE": "granted",
                    "ACCESS_WIFI_STATE": "granted",
                    "DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION": "granted",
                    "INTERNET": "granted",
                    "SYSTEM_ALERT_WINDOW": "not_granted",
                },
                "type": "app",
            },
            "device": {
                "family": "sdk_gphone64_arm64",
                "model": "sdk_gphone64_arm64",
                "model_id": "UPB2.230407.019",
                "battery_level": 100.0,
                "orientation": "portrait",
                "manufacturer": "Google",
                "brand": "google",
                "screen_width_pixels": 1080,
                "screen_height_pixels": 2209,
                "screen_density": 2.625,
                "screen_dpi": 420,
                "online": True,
                "charging": False,
                "low_memory": False,
                "simulator": True,
                "memory_size": 2074669056,
                "free_memory": 607039488,
                "storage_size": 6228115456,
                "free_storage": 4940427264,
                "boot_time": "2024-01-11T09:56:37.070Z",
                "timezone": "Europe/Vienna",
                "locale": "en_US",
                "processor_count": 4,
                "processor_frequency": 0,
                "archs": ["arm64-v8a"],
                "battery_temperature": 25,
                "connection_type": "wifi",
                "id": "64b13018-2922-4938-92b1-3135861a69c8",
                "language": "en",
                "type": "device",
            },
            "os": {
                "name": "Android",
                "version": "13",
                "build": "sdk_gphone64_arm64-userdebug UpsideDownCake UPB2.230407.019 10170211 dev-keys",
                "kernel_version": "6.1.21-android14-3-01811-g9e35a21ec03f-ab9850788",
                "rooted": False,
                "type": "os",
            },
        },
        "logger": "",
        "sdk": {
            "name": "sentry.javascript.react-native",
            "version": "5.15.2",
            "integrations": [
                "ModulesLoader",
                "ReactNativeErrorHandlers",
                "Release",
                "InboundFilters",
                "FunctionToString",
                "Breadcrumbs",
                "HttpContext",
                "NativeLinkedErrors",
                "EventOrigin",
                "SdkInfo",
                "ReactNativeInfo",
                "DebugSymbolicator",
                "RewriteFrames",
                "DeviceContext",
                "HermesProfiling",
                "ReactNativeTracing",
                "Screenshot",
                "ViewHierarchy",
                "HttpClient",
                "react-navigation-v5",
                "ReactNativeUserInteractionTracing",
                "ReactNativeProfiler",
                "TouchEventBoundary",
            ],
            "packages": [
                {"name": "sentry.java.android.react-native", "version": "6.34.0"},
                {"name": "npm:@sentry/react-native", "version": "5.15.2"},
            ],
        },
        "timestamp": time.time(),
        "type": "error",
        "user": {
            "email": "philipp@example.com",
            "ip_address": "85.193.160.231",
            "geo": {
                "country_code": "AT",
                "city": "Diersbach",
                "subdivision": "Upper Austria",
                "region": "Austria",
            },
        },
        "version": "7",
    }

    result.update(kwargs)
    return result
