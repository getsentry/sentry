from re import sub

import click

from sentry.runner.decorators import configuration

DETECTORS_DIR = "src/sentry/performance_issues/detectors"


def snake_to_upper_camel_case(value: str) -> str:
    """
    Converts a string from snake_case to UpperCamelCase
    """
    return "".join(word.capitalize() for word in value.strip("_").split("_"))


@click.command()
@click.argument("name", required=True)
@configuration
def createdetector(name: str) -> None:
    """Create a new Detector. Name passed must be in snake_case.
    Example invocation: sentry createdetector solar_eclipse"""
    detector_filename = f"{DETECTORS_DIR}/{name}_detector.py"
    detector_classname = snake_to_upper_camel_case(name) + "Detector"
    group_type_classname = "Performance" + snake_to_upper_camel_case(name) + "GroupType"
    detector_type = name.upper()
    feature_flag = f"performance.issues.{name}.problem-creation"

    detector_file_contents = f"""from sentry.models.organization import Organization
from sentry.models.project import Project

from ..base import DetectorType, PerformanceDetector
from ..types import Span


class {detector_classname}(PerformanceDetector):

    type = DetectorType.{detector_type}
    settings_key = DetectorType.{detector_type}

    def is_creation_allowed_for_organization(self, organization: Organization | None) -> bool:
        return False  # TODO

    def is_creation_allowed_for_project(self, project: Project) -> bool:
        return False  # TODO

    def visit_span(self, span: Span) -> None:
        pass  # TODO

    def on_complete(self) -> None:
        pass
"""
    with open(detector_filename, "w") as detector_file:
        detector_file.write(detector_file_contents)

    performance_detection_filename = "src/sentry/performance_issues/performance_detection.py"
    with open(performance_detection_filename) as performance_detection_file:
        performance_detection_file_contents = performance_detection_file.read()
    performance_detection_file_contents = sub(
        r"((from \.detectors(\.experiments)?\.\w+ import [\w\s\)\(,]+\n)+)",
        f"\\1from .detectors.{name}_detector import {detector_classname}\n",
        performance_detection_file_contents,
    )
    performance_detection_file_contents = sub(
        r"(DETECTOR_CLASSES: list\[type\[PerformanceDetector\]\] = \[\n)([^\]]+)\]",
        f"\\1\\2    {detector_classname},\n]",
        performance_detection_file_contents,
    )
    performance_detection_file_contents = sub(
        r"(def get_detection_settings[\(\):.\w\s=\|\[\]\->_,]+return \{)(([.\s]*DetectorType\.[^\{]+[^\}]+\},?)+)(\s+\})",
        f"\\1\\2\n        DetectorType.{detector_type}: {{\n            # TODO\n        }}\\4",
        performance_detection_file_contents,
    )

    with open(performance_detection_filename, "w") as performance_detection_file:
        performance_detection_file.write(performance_detection_file_contents)

    base_filename = "src/sentry/performance_issues/base.py"
    with open(base_filename) as base_file:
        base_file_contents = base_file.read()
    base_file_contents = sub(
        r"(class DetectorType\(Enum\):)((\s+[A-Z_]+ ?= ?\"[a-z_]+\"\n)+)",
        f'\\1\\2    {detector_type} = "{name}"\n',
        base_file_contents,
    )
    base_file_contents = sub(
        r"(DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION = \{[^\}]+)(\})",
        f'\\1    DetectorType.{detector_type}: "{feature_flag}",\n\\2',
        base_file_contents,
    )
    with open(base_filename, "w") as base_file:
        base_file.write(base_file_contents)

    defaults_filename = "src/sentry/options/defaults.py"
    with open(defaults_filename) as defaults_file:
        defaults_file_contents = defaults_file.read()

    with open(defaults_filename, "w") as defaults_file:
        defaults_file.write(
            sub(
                r"((register\([^\)]*performance\.issues..*.problem-creation[^\)]*\)\n?)+)",
                f"""\\1register(
        "{feature_flag}",
        default=0.0,
        flags=FLAG_AUTOMATOR_MODIFIABLE,
    )
    """,
                defaults_file_contents,
            )
        )

    grouptype_filename = "src/sentry/issues/grouptype.py"
    with open(grouptype_filename, "a") as grouptype_file:
        grouptype_file.write(
            f"""

# TODO: Sort this appropriately after you pick out a type_id!
@dataclass(frozen=True)
class {group_type_classname}(PerformanceGroupTypeDefaults, GroupType):
    type_id = None  # TODO
    slug = None  # TODO
    description = None  # TODO
    category = GroupCategory.TODO.value  # TODO
    category_v2 = GroupCategory.TODO.value  # TODO
    released = False  # TODO
    creation_quota = Quota(3600, 60, 60_000)  # TODO
    notification_config = NotificationConfig(context=[])  # TODO
"""
        )
