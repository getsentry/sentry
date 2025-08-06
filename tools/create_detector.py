"""
Utility script to easily create a new detector.

Example invocation:
python3 create_detector.py solar_eclipse
"""

from re import sub

DETECTORS_DIR = "src/sentry/performance_issues/detectors"


def snake_to_upper_camel_case(value: str) -> str:
    """
    Converts a string from snake_case to UpperCamelCase
    """
    return "".join(word.capitalize() for word in value.strip("_").split("_"))


def create_detector(detector_name: str) -> None:
    detector_filename = f"{DETECTORS_DIR}/{detector_name}_detector.py"
    detector_file = open(detector_filename, "w")

    detector_classname = snake_to_upper_camel_case(detector_name) + "Detector"
    group_type_classname = "Performance" + snake_to_upper_camel_case(detector_name) + "GroupType"
    detector_type = detector_name.upper()
    feature_flag = f"performance.issues.{detector_name}.problem-creation"

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
    detector_file.write(detector_file_contents)

    performance_detection_filename = "src/sentry/performance_issues/performance_detection.py"
    performance_detection_file_contents = open(performance_detection_filename).read()
    performance_detection_file_contents = sub(
        r"((from \.detectors(\.experiments)?\.\w+ import [\w\s\)\(,]+\n)+)",
        f"\\1from .detectors.{detector_name}_detector import {detector_classname}\n",
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

    open(performance_detection_filename, "w").write(performance_detection_file_contents)

    base_filename = "src/sentry/performance_issues/base.py"
    base_file_contents = open(base_filename).read()
    base_file_contents = sub(
        r"(class DetectorType\(Enum\):)((\s+[A-Z_]+ ?= ?\"[a-z_]+\"\n)+)",
        f'\\1\\2    {detector_type} = "{detector_name}"\n',
        base_file_contents,
    )
    base_file_contents = sub(
        r"(DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION = \{[^\}]+)(\})",
        f'\\1    DetectorType.{detector_type}: "{feature_flag}",\n\\2',
        base_file_contents,
    )
    open(base_filename, "w").write(base_file_contents)

    defaults_filename = "src/sentry/options/defaults.py"
    defaults_file_contents = open(defaults_filename).read()

    open(defaults_filename, "w").write(
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
    open(grouptype_filename, "a").write(
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


if __name__ == "__main__":
    import sys

    create_detector(sys.argv[1])
