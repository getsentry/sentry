from __future__ import annotations

from typing import TypedDict

from sentry.models.project import Project
from sentry.preprod.vcs.status_checks.snapshots.config import (
    ENABLED_DEFAULT,
    ENABLED_OPTION_KEY,
    FAIL_ON_ADDED_DEFAULT,
    FAIL_ON_ADDED_OPTION_KEY,
    FAIL_ON_CHANGED_DEFAULT,
    FAIL_ON_CHANGED_OPTION_KEY,
    FAIL_ON_REMOVED_DEFAULT,
    FAIL_ON_REMOVED_OPTION_KEY,
    FAIL_ON_RENAMED_DEFAULT,
    FAIL_ON_RENAMED_OPTION_KEY,
)


class SnapshotStatusCheckRulesResponseDict(TypedDict):
    failOnAdded: bool
    failOnRemoved: bool
    failOnChanged: bool
    failOnRenamed: bool


class ProjectSnapshotStatusCheckRulesResponseDict(TypedDict):
    enabled: bool
    rules: SnapshotStatusCheckRulesResponseDict


def create_project_snapshot_status_check_rules_response(
    project: Project,
) -> ProjectSnapshotStatusCheckRulesResponseDict:
    return {
        "enabled": project.get_option(ENABLED_OPTION_KEY, default=ENABLED_DEFAULT),
        "rules": {
            "failOnAdded": project.get_option(
                FAIL_ON_ADDED_OPTION_KEY, default=FAIL_ON_ADDED_DEFAULT
            ),
            "failOnRemoved": project.get_option(
                FAIL_ON_REMOVED_OPTION_KEY, default=FAIL_ON_REMOVED_DEFAULT
            ),
            "failOnChanged": project.get_option(
                FAIL_ON_CHANGED_OPTION_KEY, default=FAIL_ON_CHANGED_DEFAULT
            ),
            "failOnRenamed": project.get_option(
                FAIL_ON_RENAMED_OPTION_KEY, default=FAIL_ON_RENAMED_DEFAULT
            ),
        },
    }
