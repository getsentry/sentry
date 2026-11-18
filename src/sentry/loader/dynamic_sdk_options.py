from enum import Enum
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentry.models.project import Project
    from sentry.models.projectkey import ProjectKey


class DynamicSdkLoaderOption(str, Enum):
    HAS_REPLAY = "hasReplay"
    HAS_PERFORMANCE = "hasPerformance"
    HAS_DEBUG = "hasDebug"
    HAS_FEEDBACK = "hasFeedback"
    HAS_LOGS_AND_METRICS = "hasLogsAndMetrics"


def get_dynamic_sdk_loader_option(
    project_key: "ProjectKey", option: DynamicSdkLoaderOption, default: bool = False
) -> bool:
    dynamic_sdk_loader_options = project_key.data.get("dynamicSdkLoaderOptions", {})
    return dynamic_sdk_loader_options.get(option.value, default)


def get_default_loader_data(project: "Project") -> dict[str, object]:
    dynamic_sdk_loader_options = project.get_option("sentry:default_loader_options", None)

    if dynamic_sdk_loader_options is not None:
        return {"dynamicSdkLoaderOptions": dynamic_sdk_loader_options}

    return {}
