from enum import Enum


class DynamicSdkLoaderOption(str, Enum):
    HAS_REPLAY = "hasReplay"
    HAS_PERFORMANCE = "hasPerformance"
    HAS_DEBUG = "hasDebug"


def get_dynamic_sdk_loader_option(project_key, option: DynamicSdkLoaderOption, default=False):
    dynamic_sdk_loader_options = project_key.data.get("dynamicSdkLoaderOptions", {})
    return dynamic_sdk_loader_options.get(option.value, default)
