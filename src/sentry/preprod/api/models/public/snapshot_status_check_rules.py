from __future__ import annotations

from typing import Annotated, TypedDict

from sentry.apidocs.descriptions import ApiDescription
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
    failOnAdded: Annotated[
        bool, ApiDescription("Whether the snapshot status check fails when snapshots are added")
    ]
    failOnRemoved: Annotated[
        bool, ApiDescription("Whether the snapshot status check fails when snapshots are removed")
    ]
    failOnChanged: Annotated[
        bool, ApiDescription("Whether the snapshot status check fails when snapshots change")
    ]
    failOnRenamed: Annotated[
        bool, ApiDescription("Whether the snapshot status check fails when snapshots are renamed")
    ]


class ProjectSnapshotStatusCheckRulesResponseDict(TypedDict):
    enabled: Annotated[
        bool, ApiDescription("Whether snapshot status checks are enabled for the project")
    ]
    rules: Annotated[
        SnapshotStatusCheckRulesResponseDict,
        ApiDescription("Which snapshot changes make the status check fail"),
    ]


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
