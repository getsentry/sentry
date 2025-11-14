from typing import int
from collections.abc import Callable, Collection
from types import ModuleType

import pytest

from sentry.models.project import Project
from sentry.services.eventstore.models import Event
from sentry.utils.sdk_crashes.path_replacer import FixedPathReplacer
from sentry.utils.sdk_crashes.sdk_crash_detection_config import (
    SDKCrashDetectionConfig,
    SDKFrameConfig,
    SdkName,
)


@pytest.fixture
def store_event(
    default_project: Project, factories: ModuleType
) -> Callable[[dict[str, Collection[str]]], Event]:
    def inner(data: dict[str, Collection[str]]) -> Event:
        return factories.store_event(data=data, project_id=default_project.id)

    return inner


@pytest.fixture
def empty_cocoa_config() -> SDKCrashDetectionConfig:
    return SDKCrashDetectionConfig(
        sdk_name=SdkName.Cocoa,
        project_id=0,
        sample_rate=0.0,
        organization_allowlist=[],
        sdk_names={},
        report_fatal_errors=False,
        ignore_mechanism_type=set(),
        allow_mechanism_type=set(),
        system_library_path_patterns=set(),
        sdk_frame_config=SDKFrameConfig(
            function_patterns=set(),
            path_patterns=set(),
            path_replacer=FixedPathReplacer(path=""),
        ),
        sdk_crash_ignore_matchers=set(),
    )
