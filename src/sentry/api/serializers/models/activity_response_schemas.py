"""
API response schema for an issue's activity feed, as a union discriminated on `type`.

Two serializers produce the feed: `ActivitySerializer` (Activity rows) and
`GroupActionLogEntrySerializer` (action log entries). Every activity type maps to a
`GroupAction` model in `sentry.issues.action_log.types`, which `activity_to_action`
validates each Activity against before it's logged. Those models are the schema of the
data, so each variant's `data` is built from its model, with the Activity key names that
`activity_translator` maps back to. A new activity type or a changed model shows up here
without a hand-written copy; a new field without a description fails
`make build-api-docs`.

On top of that, `_DATA_OVERRIDES` covers the types whose data both serializers replace,
such as commit and pull request IDs that become serialized objects, and
`_ACTIVITY_ONLY_PROPERTIES` covers keys that Activity producers write but the model
doesn't keep, so only the Activity path returns them.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from sentry.apidocs.json_schemas import to_response_schema
from sentry.issues.action_log.types import GroupAction, GroupActionType
from sentry.types.activity import HIDDEN_ACTIVITY_TYPES, ActivityType

_INTEGRATION_PROPERTIES: dict[str, dict[str, Any]] = {
    "integration_id": {
        "type": "integer",
        "description": "ID of the integration that changed the status, when an integration did",
    },
    "provider": {
        "type": "string",
        "description": "Name of the integration provider, such as Jira",
    },
    "provider_key": {
        "type": "string",
        "description": "Key of the integration provider, such as jira",
    },
}

_SEER_PULL_REQUESTS: dict[str, Any] = {
    "type": "array",
    "description": "Pull requests that Seer opened or updated",
    "items": {
        "type": "object",
        "properties": {
            "provider": {"type": "string", "description": "Code host, such as github"},
            "repo_name": {"type": "string", "description": "Repository, such as owner/repo"},
            "pull_request": {
                "type": "object",
                "description": "The pull request",
                "properties": {
                    "pr_number": {
                        # The action log model's dict[str, str | ...] turns it into a string.
                        "anyOf": [{"type": "integer"}, {"type": "string"}],
                        "description": "Number of the pull request",
                    },
                    "pr_url": {"type": "string", "description": "URL of the pull request"},
                },
            },
        },
    },
}

# Keys that Activity producers write but the GroupAction model drops. Each lists its writer.
_ACTIVITY_ONLY_PROPERTIES: dict[ActivityType, dict[str, dict[str, Any]]] = {
    # integrations/tasks/sync_status_inbound.py
    ActivityType.SET_RESOLVED: _INTEGRATION_PROPERTIES,
    ActivityType.SET_UNRESOLVED: {
        **_INTEGRATION_PROPERTIES,
        # issues/escalating/escalating.py
        "forecast": {
            "type": "integer",
            "description": "Forecast of the issue's daily events when it escalated",
        },
    },
    ActivityType.SET_RESOLVED_IN_RELEASE: {
        **_INTEGRATION_PROPERTIES,
        "inNextRelease": {
            "type": "boolean",
            "description": "Whether the issue resolves in the next release",
        },
    },
    # event_manager.py
    ActivityType.SET_REGRESSION: {
        "event_type": {"type": "string", "description": "Type of the event that regressed"},
        "follows_semver": {
            "type": "boolean",
            "description": "Whether the project's releases follow semantic versioning",
        },
        "resolved_in_version": {
            "type": "string",
            "description": "Release the issue was resolved in before it regressed",
        },
    },
    # issues/update_inbox.py
    ActivityType.AUTO_SET_ONGOING: {
        "manually": {
            "type": "boolean",
            "description": "Whether a user marked the issue reviewed, rather than time passing",
        },
    },
    # seer/entrypoints/operator.py. It also passes Seer's code_changes through unchanged.
    ActivityType.SEER_ITERATION_COMPLETED: {
        "run_id": {"type": "integer", "description": "ID of the Seer run"},
        "iteration_index": {"type": "integer", "description": "Number of the iteration"},
        "pull_requests": _SEER_PULL_REQUESTS,
    },
}

_DESCRIPTIONS = {
    "referrer": "What started the Autofix run, such as api.web or slack",
    "provider": "Integration provider, such as Jira or GitHub",
    "external_issue_key": "Key of the external issue, such as PROJ-123",
    "service_type": "Slug of the Sentry App that owns the external issue",
    "display_name": "Display name of the external issue",
    "web_url": "URL of the external issue",
    "has_other_open_prs": "Whether other pull requests linked to the issue are still open",
    "event_id": "ID of the event that caused the change",
    "ignoreCount": "Number of events after which the issue is unarchived",
    "ignoreDuration": "Minutes the issue is archived for",
    "ignoreUntil": "When the issue is unarchived (ISO 8601)",
    "ignoreUserCount": "Number of affected users after which the issue is unarchived",
    "ignoreUserWindow": "Minutes over which ignoreUserCount is counted",
    "ignoreWindow": "Minutes over which ignoreCount is counted",
    "ignoreUntilEscalating": "Whether the issue is archived until it escalates",
    "version": "Version of the release",
    "title": "Title of the external issue",
    "location": "URL of the external issue",
    "label": "Label of the external issue, such as PROJ-123",
    "new": "Whether the external issue was created, rather than linked",
    "assignee": "ID of the user or team the issue was assigned to",
    "assigneeEmail": "Email of the user the issue was assigned to",
    "assigneeName": "Name of the user or team the issue was assigned to",
    "assigneeType": "What the issue was assigned to: user or team",
    "integration": "What assigned the issue, such as codeowners or projectOwnership",
    "rule": "Ownership rule that assigned the issue",
    "current_release_version": "Latest release when the issue was resolved, for semver releases",
    "age": "Hours without events after which the issue resolved",
    "commit": "The commit that resolves the issue",
    "fingerprints": "Fingerprints that were unmerged",
    "destination_id": "ID of the issue the events moved to",
    "source_id": "ID of the issue the events moved from",
    "eventCount": "Number of events reprocessed",
    "oldGroupId": "ID of the issue the events were reprocessed from",
    "newGroupId": "ID of the issue the events were reprocessed into",
    "after_days": "Days after which the issue became ongoing",
    "forecast": "Forecast of the issue's daily events when it escalated",
    "priority": "New priority of the issue: high, medium or low",
    "reason": "Why the priority changed, such as escalating or ongoing",
    "run_id": "ID of the Seer run",
    "summary": "One-line summary of what Seer found",
    "root_cause": "Root cause that Seer found",
    "solution": "Solution that Seer proposed",
    "changes": "Code changes that Seer made",
}

_EXPIRED_SNOOZE: dict[str, Any] = {
    "type": "object",
    "nullable": True,
    "description": "The archive conditions that expired when the issue escalated",
    "properties": {
        "count": {"type": "integer", "nullable": True, "description": "Event count condition"},
        "until": {"type": "string", "nullable": True, "description": "Date condition"},
        "user_count": {"type": "integer", "nullable": True, "description": "User count condition"},
        "user_window": {
            "type": "integer",
            "nullable": True,
            "description": "Minutes over which user_count is counted",
        },
        "window": {
            "type": "integer",
            "nullable": True,
            "description": "Minutes over which count is counted",
        },
    },
}

# Types that never belong to an issue: releases and deploys are project activity, and
# nothing creates processing-issue activity any more.
_NOT_ISSUE_ACTIVITY = frozenset(
    {ActivityType.RELEASE, ActivityType.DEPLOY, ActivityType.NEW_PROCESSING_ISSUES}
)

_EMPTY = {"type": "object", "maxProperties": 0}


def _object(properties: dict[str, Any], *, required: tuple[str, ...] = ()) -> dict[str, Any]:
    schema: dict[str, Any] = {"type": "object", "properties": properties}
    if required:
        schema["required"] = list(required)
    return schema


def _nullable(schema: dict[str, Any], description: str) -> dict[str, Any]:
    return {**schema, "nullable": True, "description": description}


def _data_overrides(resolve: Callable[[Any], dict[str, Any]]) -> dict[str, dict[str, Any]]:
    from sentry.api.serializers.models.activity import ResolvedMention
    from sentry.api.serializers.models.commit import CommitSerializerResponseWithReleases
    from sentry.api.serializers.models.group import BaseGroupSerializerResponse
    from sentry.api.serializers.models.pullrequest import PullRequestSerializerResponse

    commit = _nullable(resolve(CommitSerializerResponseWithReleases), "The commit")
    pull_request = _nullable(resolve(PullRequestSerializerResponse), "The pull request")
    commit_data = _object({"commit": commit})
    pull_request_data = _object({"pullRequest": pull_request})
    fingerprints = {"type": "array", "items": {"type": "string"}, "description": "Fingerprints"}
    return {
        "note": _object(
            {
                "text": {"type": "string", "description": "Text of the comment, in Markdown"},
                "comment_id": {"type": "integer", "description": "ID of the comment"},
                "mentions": {
                    "type": "array",
                    "items": resolve(ResolvedMention),
                    "description": "Users the comment mentions",
                },
            },
            required=("text",),
        ),
        "set_resolved_in_commit": commit_data,
        "referenced_in_commit": commit_data,
        "set_resolved_in_pull_request": pull_request_data,
        "pull_request_closed": pull_request_data,
        "pull_request_reopened": pull_request_data,
        "pull_request_merged": pull_request_data,
        "pull_request_unlinked": pull_request_data,
        "unmerge_source": _object(
            {
                "fingerprints": fingerprints,
                "destination": _nullable(
                    resolve(BaseGroupSerializerResponse), "Issue the events moved to"
                ),
            },
            required=("fingerprints",),
        ),
        "unmerge_destination": _object(
            {
                "fingerprints": fingerprints,
                "source": _nullable(
                    resolve(BaseGroupSerializerResponse), "Issue the events moved from"
                ),
            },
            required=("fingerprints",),
        ),
        "merge": _object(
            {
                "issues": {
                    "type": "array",
                    "description": "Issues merged into this one",
                    "items": _object(
                        {
                            "id": {
                                "anyOf": [{"type": "integer"}, {"type": "string"}],
                                "description": "ID of the merged issue",
                            }
                        },
                        required=("id",),
                    ),
                }
            },
            required=("issues",),
        ),
        "first_seen": _object(
            {
                "priority": {
                    "type": "string",
                    "nullable": True,
                    "enum": ["high", "medium", "low", None],
                    "description": "Priority the issue was created with",
                }
            },
            required=("priority",),
        ),
        "impact_assessment": _object(
            {
                "score": {
                    "type": "number",
                    "nullable": True,
                    "description": "Impact score from 0 to 100",
                },
                "level": {
                    "type": "string",
                    "nullable": True,
                    "enum": ["super_low", "low", "moderate", "high", "super_high", None],
                    "description": "Impact level that the score falls in",
                },
                "description": {"type": "string", "description": "What the impact is"},
                "citations": {
                    "type": "array",
                    "description": "Evidence for the assessment",
                    "items": _object(
                        {
                            "claim": {"type": "string", "description": "What is claimed"},
                            "reference": {"type": "string", "description": "What backs it"},
                            "source": {"type": "string", "description": "Where it comes from"},
                        },
                        required=("claim", "reference", "source"),
                    ),
                },
                "sourceEventId": {
                    "type": "string",
                    "description": "ID of the event the assessment is based on",
                },
            },
            required=("score", "level", "description", "citations", "sourceEventId"),
        ),
    }


def _model_data_schema(activity_type: ActivityType, action: type[GroupAction]) -> dict[str, Any]:
    from sentry.utils.action_log.activity_translator import ACTIVITY_TYPE_TO_ARG_TRANSLATIONS

    model_schema = action.schema()
    to_activity_key = {
        model_key: activity_key
        for activity_key, model_key in ACTIVITY_TYPE_TO_ARG_TRANSLATIONS.get(
            activity_type.value, {}
        ).items()
    }
    properties: dict[str, Any] = {}
    for name, spec in model_schema.get("properties", {}).items():
        spec = {k: v for k, v in spec.items() if k not in ("title", "default")}
        # The models leave these as loose dicts; the Seer webhook payload and the frontend
        # pin them down.
        if name == "pull_requests":
            spec = {**_SEER_PULL_REQUESTS, "nullable": True}
        elif name == "expired_snooze":
            spec = _EXPIRED_SNOOZE
        elif action.__fields__[name].allow_none:
            # The action log stores every field, so an unset optional field is null.
            spec = {"anyOf": [spec, {"type": "null"}]}
        properties[to_activity_key.get(name, name)] = spec
    properties.update(_ACTIVITY_ONLY_PROPERTIES.get(activity_type, {}))
    if not properties:
        return dict(_EMPTY)
    return to_response_schema(
        {"type": "object", "properties": properties},
        definitions=model_schema.get("definitions", {}),
        descriptions=_DESCRIPTIONS,
    )


def activity_type_names() -> list[str]:
    """`type` of every activity an issue's feed can return."""
    return sorted(_variant_actions())


def _variant_actions() -> dict[str, tuple[ActivityType | None, type[GroupAction]]]:
    from sentry.utils.action_log.activity_translator import ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE

    variants: dict[str, tuple[ActivityType | None, type[GroupAction]]] = {}
    for value, action in ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE.items():
        activity_type = ActivityType(value)
        if activity_type in HIDDEN_ACTIVITY_TYPES or activity_type in _NOT_ISSUE_ACTIVITY:
            continue
        variants[activity_type.name.lower()] = (activity_type, action)
    # Action log types without an Activity equivalent keep their own name.
    for action_type in GroupAction.get_user_visible_types():
        log_only = GroupAction.by_type(action_type)
        if log_only is not None and not any(log_only is a for _, a in variants.values()):
            variants[GroupActionType(action_type).name.lower()] = (None, log_only)
    return variants


def group_activity_schema() -> dict[str, Any]:
    from sentry.api.serializers.models.activity import ActivitySerializerResponse
    from sentry.api.serializers.models.groupactionlogentry import (
        GroupActionLogEntrySerializerResponse,
    )
    from sentry.apidocs.spectacular_ports import resolve_type_hint

    envelope = resolve_type_hint(ActivitySerializerResponse)
    # Only action log entries have a source.
    source = resolve_type_hint(GroupActionLogEntrySerializerResponse)["properties"]["source"]
    envelope["properties"]["source"] = source
    overrides = _data_overrides(resolve_type_hint)
    branches = []
    for name, (activity_type, action) in sorted(_variant_actions().items()):
        data: dict[str, Any]
        if name in ("unmerge_source", "unmerge_destination") and activity_type is not None:
            # GroupActionLogEntrySerializer returns the stored IDs; only ActivitySerializer
            # swaps them for the serialized issue.
            data = {"anyOf": [overrides[name], _model_data_schema(activity_type, action)]}
        elif name in overrides:
            data = overrides[name]
        elif activity_type is None:
            data = to_response_schema(
                {k: v for k, v in action.schema().items() if k != "title"},
                descriptions=_DESCRIPTIONS,
            )
        else:
            data = _model_data_schema(activity_type, action)
        if activity_type is ActivityType.SET_RESOLVED_IN_RELEASE:
            # Both serializers replace the commit ID with the serialized commit.
            data["properties"]["commit"] = overrides["referenced_in_commit"]["properties"]["commit"]
        properties = envelope["properties"]
        branches.append(
            {
                **envelope,
                "properties": {
                    **properties,
                    "type": {**properties["type"], "enum": [name]},
                    "data": {**data, "description": properties["data"]["description"]},
                },
            }
        )
    return {"anyOf": branches}
