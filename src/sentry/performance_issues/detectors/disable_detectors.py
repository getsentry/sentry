from typing import TypedDict

from sentry import projectoptions
from sentry.models.project import Project


class DetectorDisablingConfig(TypedDict):
    detector_project_option: str
    languages_to_disable: set[str]


SETTINGS_PROJECT_OPTION_KEY = "sentry:performance_issue_settings"

DEFAULT_DETECTOR_DISABLING_CONFIGS: list[DetectorDisablingConfig] = [
    {
        "detector_project_option": "db_query_injection_detection_enabled",
        "languages_to_disable": {
            "php",
            "php-laravel",
            "php-symfony",
            "go",
            "go-echo",
            "go-fasthttp",
            "go-fiber",
            "go-gin",
            "go-http",
            "go-iris",
            "go-martini",
            "go-negroni",
        },
    }
]


def set_default_disabled_detectors(project: Project) -> None:
    performance_issue_settings_default = projectoptions.get_well_known_default(
        SETTINGS_PROJECT_OPTION_KEY,
        project=project,
    )
    performance_issue_settings = project.get_option(
        SETTINGS_PROJECT_OPTION_KEY, default=performance_issue_settings_default
    )

    disabled_by_config_keys = set()
    for disable_config in DEFAULT_DETECTOR_DISABLING_CONFIGS:
        if project.platform in disable_config["languages_to_disable"]:
            disabled_by_config_keys.add(disable_config["detector_project_option"])

    disabled_by_config = {k: False for k in disabled_by_config_keys}

    project.update_option(
        SETTINGS_PROJECT_OPTION_KEY,
        {
            **performance_issue_settings_default,
            **performance_issue_settings,
            **disabled_by_config,
        },
    )
