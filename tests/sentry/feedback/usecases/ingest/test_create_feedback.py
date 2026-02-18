from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import patch

import pytest

from sentry.feedback.lib.utils import FeedbackCreationSource
from sentry.feedback.usecases.ingest.create_feedback import (
    create_feedback_issue,
    fix_for_issue_platform,
    validate_issue_platform_event_schema,
)
from sentry.feedback.usecases.label_generation import (
    AI_LABEL_TAG_PREFIX,
    MAX_AI_LABELS,
    MAX_AI_LABELS_JSON_LENGTH,
)
from sentry.models.group import Group, GroupStatus
from sentry.signals import first_feedback_received, first_new_feedback_received
from sentry.testutils.helpers import Feature
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.group import GroupSubStatus
from sentry.utils import json
from tests.sentry.feedback import mock_feedback_event


@pytest.fixture(autouse=True)
def mock_has_seer_access():
    """
    Auto mocks `has_seer_access` so it returns false by default.
    To enable, request the fixture and set mock_has_seer_access.return_value = True
    """
    with patch(
        "sentry.feedback.usecases.ingest.create_feedback.has_seer_access",
        return_value=False,
    ) as mck:
        yield mck


def test_fix_for_issue_platform() -> None:
    event: dict[str, Any] = {
        "project_id": 1,
        "request": {
            "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
            },
        },
        "event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
        "timestamp": 1698255009.574,
        "received": "2021-10-24T22:23:29.574000+00:00",
        "environment": "prod",
        "release": "frontend@daf1316f209d961443664cd6eb4231ca154db502",
        "sdk": {
            "integrations": [
                "InboundFilters",
                "FunctionToString",
                "TryCatch",
                "Breadcrumbs",
                "GlobalHandlers",
                "LinkedErrors",
                "Dedupe",
                "HttpContext",
                "ExtraErrorData",
                "BrowserTracing",
                "BrowserProfilingIntegration",
            ],
            "name": "sentry.javascript.react",
            "version": "7.75.0",
        },
        "tags": {
            "transaction": "/feedback/",
            "sentry_version": "23.11.0.dev0",
            "isCustomerDomain": "yes",
            "customerDomain.organizationUrl": "https://sentry.sentry.io",
            "customerDomain.sentryUrl": "https://sentry.io",
            "customerDomain.subdomain": "sentry",
            "organization": "1",
            "organization.slug": "sentry",
            "plan": "am2_business_ent_auf",
            "plan.name": "Business",
            "plan.max_members": "null",
            "plan.total_members": "414",
            "plan.tier": "am2",
            "timeOrigin.mode": "navigationStart",
        },
        "user": {
            "ip_address": "72.164.175.154",
            "email": "josh.ferge@sentry.io",
            "id": 880461,
            "isStaff": False,
            "name": "Josh Ferge",
            "sentry_user": "test@test.com",
        },
        "contexts": {
            "feedback": {
                "contact_email": "josh.ferge@sentry.io",
                "name": "Josh Ferge",
                "message": "josh ferge testing again!",
                "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            },
            "trace": {
                "op": "navigation",
                "span_id": "9ffadde1100e4d55",
                "tags": {
                    "routing.instrumentation": "react-router-v3",
                    "from": "/issues/(searches/:searchId/)",
                },
                "trace_id": "8e51f44000d34b8d871cea7f0c3e394c",
            },
            "organization": {"id": "1", "slug": "sentry"},
        },
        "breadcrumbs": [],
        "platform": "javascript",
    }

    fixed_event = fix_for_issue_platform(event)
    validate_issue_platform_event_schema(fixed_event)
    assert fixed_event["contexts"]["replay"]["replay_id"] == "3d621c61593c4ff9b43f8490a78ae18e"
    assert fixed_event["contexts"]["feedback"] == {
        "contact_email": "josh.ferge@sentry.io",
        "name": "Josh Ferge",
        "message": "josh ferge testing again!",
        "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
        "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
    }
    assert fixed_event["logentry"]["message"] == event["contexts"]["feedback"]["message"]

    # Assert the contact-email is set as the user-email when no user-email exists.
    event["user"].pop("email")
    fixed_event = fix_for_issue_platform(event)
    assert fixed_event["user"]["email"] == event["contexts"]["feedback"]["contact_email"]


def test_corrected_still_works() -> None:
    event: dict[str, Any] = {
        "project_id": 1,
        "request": {
            "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
            },
        },
        "event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
        "timestamp": 1698255009.574,
        "received": "2021-10-24T22:23:29.574000+00:00",
        "environment": "prod",
        "release": "frontend@daf1316f209d961443664cd6eb4231ca154db502",
        "sdk": {
            "integrations": [
                "InboundFilters",
                "FunctionToString",
                "TryCatch",
                "Breadcrumbs",
                "GlobalHandlers",
                "LinkedErrors",
                "Dedupe",
                "HttpContext",
                "ExtraErrorData",
                "BrowserTracing",
                "BrowserProfilingIntegration",
            ],
            "name": "sentry.javascript.react",
            "version": "7.75.0",
        },
        "tags": {
            "transaction": "/feedback/",
            "sentry_version": "23.11.0.dev0",
            "isCustomerDomain": "yes",
            "customerDomain.organizationUrl": "https://sentry.sentry.io",
            "customerDomain.sentryUrl": "https://sentry.io",
            "customerDomain.subdomain": "sentry",
            "organization": "1",
            "organization.slug": "sentry",
            "plan": "am2_business_ent_auf",
            "plan.name": "Business",
            "plan.max_members": "null",
            "plan.total_members": "414",
            "plan.tier": "am2",
            "timeOrigin.mode": "navigationStart",
        },
        "user": {
            "ip_address": "72.164.175.154",
            "email": "josh.ferge@sentry.io",
            "id": 880461,
            "isStaff": False,
            "name": "Josh Ferge",
        },
        "contexts": {
            "trace": {
                "op": "navigation",
                "span_id": "9ffadde1100e4d55",
                "tags": {
                    "routing.instrumentation": "react-router-v3",
                    "from": "/issues/(searches/:searchId/)",
                },
                "trace_id": "8e51f44000d34b8d871cea7f0c3e394c",
            },
            "organization": {"id": "1", "slug": "sentry"},
            "feedback": {
                "contact_email": "josh.ferge@sentry.io",
                "name": "Josh Ferge",
                "message": "josh ferge testing again!",
                "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            },
            "replay": {
                "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
            },
        },
        "breadcrumbs": [],
        "platform": "javascript",
    }

    fixed_event = fix_for_issue_platform(event)
    validate_issue_platform_event_schema(fixed_event)

    assert fixed_event["contexts"]["replay"]["replay_id"] == "3d621c61593c4ff9b43f8490a78ae18e"
    assert fixed_event["contexts"]["feedback"] == {
        "contact_email": "josh.ferge@sentry.io",
        "name": "Josh Ferge",
        "message": "josh ferge testing again!",
        "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
        "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
    }
    assert isinstance(fixed_event["received"], str)


@pytest.mark.parametrize("environment", ("missing", None, "", "my-environment"))
def test_fix_for_issue_platform_environment(environment) -> None:
    event = mock_feedback_event(1)
    if environment == "missing":
        event.pop("environment", "")
    else:
        event["environment"] = environment

    fixed_event = fix_for_issue_platform(event)
    if environment == "my-environment":
        assert fixed_event["environment"] == environment
    else:
        assert fixed_event["environment"] == "production"


@django_db_all
def test_create_feedback_filters_unreal(default_project, mock_produce_occurrence_to_kafka) -> None:
    event = {
        "project_id": 1,
        "request": {
            "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
            },
        },
        "event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
        "timestamp": 1698255009.574,
        "received": "2021-10-24T22:23:29.574000+00:00",
        "environment": "prod",
        "release": "frontend@daf1316f209d961443664cd6eb4231ca154db502",
        "user": {
            "ip_address": "72.164.175.154",
            "email": "josh.ferge@sentry.io",
            "id": 880461,
            "isStaff": False,
            "name": "Josh Ferge",
        },
        "contexts": {
            "feedback": {
                "contact_email": "josh.ferge@sentry.io",
                "name": "Josh Ferge",
                "message": "Sent in the unattended mode",
                "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            },
        },
        "breadcrumbs": [],
        "platform": "javascript",
    }
    create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    assert mock_produce_occurrence_to_kafka.call_count == 0


@django_db_all
def test_create_feedback_filters_empty(default_project, mock_produce_occurrence_to_kafka) -> None:
    event = {
        "project_id": 1,
        "request": {
            "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
            },
        },
        "event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
        "timestamp": 1698255009.574,
        "received": "2021-10-24T22:23:29.574000+00:00",
        "environment": "prod",
        "release": "frontend@daf1316f209d961443664cd6eb4231ca154db502",
        "user": {
            "ip_address": "72.164.175.154",
            "email": "josh.ferge@sentry.io",
            "id": 880461,
            "isStaff": False,
            "name": "Josh Ferge",
        },
        "contexts": {
            "feedback": {
                "contact_email": "josh.ferge@sentry.io",
                "name": "Josh Ferge",
                "message": "      ",
                "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            },
        },
        "breadcrumbs": [],
        "platform": "javascript",
    }

    event_2 = {
        "project_id": 1,
        "request": {
            "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
            },
        },
        "event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
        "timestamp": 1698255009.574,
        "received": "2021-10-24T22:23:29.574000+00:00",
        "environment": "prod",
        "release": "frontend@daf1316f209d961443664cd6eb4231ca154db502",
        "user": {
            "ip_address": "72.164.175.154",
            "email": "josh.ferge@sentry.io",
            "id": 880461,
            "isStaff": False,
            "name": "Josh Ferge",
        },
        "contexts": {
            "feedback": {
                "contact_email": "josh.ferge@sentry.io",
                "name": "Josh Ferge",
                "message": "",
                "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            },
        },
        "breadcrumbs": [],
        "platform": "javascript",
    }
    create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)
    create_feedback_issue(event_2, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    assert mock_produce_occurrence_to_kafka.call_count == 0


@django_db_all
def test_create_feedback_filters_no_contexts_or_message(
    default_project, mock_produce_occurrence_to_kafka
):
    event_no_context = {
        "project_id": 1,
        "request": {
            "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
            },
        },
        "event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
        "timestamp": 1698255009.574,
        "received": "2021-10-24T22:23:29.574000+00:00",
        "environment": "prod",
        "release": "frontend@daf1316f209d961443664cd6eb4231ca154db502",
        "user": {
            "ip_address": "72.164.175.154",
            "email": "josh.ferge@sentry.io",
            "id": 880461,
            "isStaff": False,
            "name": "Josh Ferge",
        },
        "breadcrumbs": [],
        "platform": "javascript",
    }

    event_no_message = {
        "project_id": 1,
        "request": {
            "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
            },
        },
        "event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
        "timestamp": 1698255009.574,
        "received": "2021-10-24T22:23:29.574000+00:00",
        "environment": "prod",
        "release": "frontend@daf1316f209d961443664cd6eb4231ca154db502",
        "user": {
            "ip_address": "72.164.175.154",
            "email": "josh.ferge@sentry.io",
            "id": 880461,
            "isStaff": False,
            "name": "Josh Ferge",
        },
        "contexts": {
            "feedback": {
                "contact_email": "josh.ferge@sentry.io",
                "name": "Josh Ferge",
                "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            },
        },
        "breadcrumbs": [],
        "platform": "javascript",
    }

    event_no_feedback = {
        "project_id": 1,
        "request": {
            "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
            },
        },
        "event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
        "timestamp": 1698255009.574,
        "received": "2021-10-24T22:23:29.574000+00:00",
        "environment": "prod",
        "release": "frontend@daf1316f209d961443664cd6eb4231ca154db502",
        "user": {
            "ip_address": "72.164.175.154",
            "email": "josh.ferge@sentry.io",
            "id": 880461,
            "isStaff": False,
            "name": "Josh Ferge",
        },
        "contexts": {},
        "breadcrumbs": [],
        "platform": "javascript",
    }

    create_feedback_issue(
        event_no_context, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
    )
    create_feedback_issue(
        event_no_message, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
    )
    create_feedback_issue(
        event_no_feedback, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
    )

    assert mock_produce_occurrence_to_kafka.call_count == 0


@django_db_all
@pytest.mark.parametrize(
    "input_message, enabled, expected_result, expected_evidence_display",
    [
        ("This is definitely spam", True, True, "True"),
        ("Valid feedback message", True, False, "False"),
        ("error", True, None, "error"),
        ("This is definitely spam", False, None, None),
        ("Valid feedback message", False, None, None),
        ("error", False, None, None),
    ],
)
@patch("sentry.feedback.usecases.ingest.create_feedback.spam_detection_enabled")
@patch("sentry.feedback.usecases.ingest.create_feedback.is_spam_seer")
def test_create_feedback_spam_detection_kafka_and_evidence(
    mock_is_spam_seer,
    mock_spam_detection_enabled,
    default_project,
    mock_produce_occurrence_to_kafka,
    input_message,
    enabled,
    expected_result,
    expected_evidence_display,
):
    mock_spam_detection_enabled.return_value = enabled
    if enabled:
        mock_is_spam_seer.return_value = expected_result

    event = mock_feedback_event(default_project.id, message=input_message)

    create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    if not enabled:
        mock_is_spam_seer.assert_not_called()

    # Check status change kafka message.
    if expected_result is True:
        assert (
            mock_produce_occurrence_to_kafka.call_args_list[1].kwargs["status_change"].new_status
            == GroupStatus.IGNORED
        )
    else:
        assert mock_produce_occurrence_to_kafka.call_count == 1

    # Check is_spam evidence
    occurrence = mock_produce_occurrence_to_kafka.call_args_list[0].kwargs["occurrence"]
    assert occurrence.evidence_data["is_spam"] == expected_result
    is_spam_displays = [e.value for e in occurrence.evidence_display if e.name == "is_spam"]
    is_spam_display = is_spam_displays[0] if is_spam_displays else None
    assert is_spam_display == expected_evidence_display

    # Check spam_detection_enabled evidence (=enabled)
    assert occurrence.evidence_data["spam_detection_enabled"] == enabled
    enabled_displays = [
        e.value for e in occurrence.evidence_display if e.name == "spam_detection_enabled"
    ]
    enabled_display = enabled_displays[0] if enabled_displays else None
    assert enabled_display == str(enabled)


@django_db_all
@patch("sentry.feedback.usecases.ingest.create_feedback.spam_detection_enabled", return_value=True)
@patch("sentry.feedback.usecases.ingest.create_feedback.is_spam_seer", return_value=True)
def test_create_feedback_spam_detection_set_status_ignored(
    mock_is_spam_seer, mock_spam_detection_enabled, default_project
) -> None:
    event = mock_feedback_event(default_project.id, message="This is definitely spam")

    create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    group = Group.objects.get()
    assert group.status == GroupStatus.IGNORED
    assert group.substatus == GroupSubStatus.FOREVER


@django_db_all
def test_create_feedback_evidence_associated_event_id(
    default_project, mock_produce_occurrence_to_kafka
):
    event = {
        "project_id": default_project.id,
        "request": {
            "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
            },
        },
        "event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
        "timestamp": 1698255009.574,
        "received": "2021-10-24T22:23:29.574000+00:00",
        "environment": "prod",
        "release": "frontend@daf1316f209d961443664cd6eb4231ca154db502",
        "user": {
            "ip_address": "72.164.175.154",
            "email": "josh.ferge@sentry.io",
            "id": 880461,
            "isStaff": False,
            "name": "Josh Ferge",
        },
        "contexts": {
            "feedback": {
                "contact_email": "josh.ferge@sentry.io",
                "name": "Josh Ferge",
                "message": "great website",
                "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
                "associated_event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
            },
        },
        "breadcrumbs": [],
        "platform": "javascript",
    }
    create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    assert mock_produce_occurrence_to_kafka.call_count == 1

    associated_event_id_evidence = [
        evidence.value
        for evidence in mock_produce_occurrence_to_kafka.call_args.kwargs[
            "occurrence"
        ].evidence_display
        if evidence.name == "associated_event_id"
    ]
    associated_event_id = associated_event_id_evidence[0] if associated_event_id_evidence else None
    assert associated_event_id == "56b08cf7852c42cbb95e4a6998c66ad6"


@django_db_all
def test_create_feedback_filters_invalid_associated_event_id(
    default_project, mock_produce_occurrence_to_kafka
):
    event = {
        "project_id": default_project.id,
        "request": {
            "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
            },
        },
        "event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
        "timestamp": 1698255009.574,
        "received": "2021-10-24T22:23:29.574000+00:00",
        "environment": "prod",
        "release": "frontend@daf1316f209d961443664cd6eb4231ca154db502",
        "user": {
            "ip_address": "72.164.175.154",
            "email": "josh.ferge@sentry.io",
            "id": 880461,
            "isStaff": False,
            "name": "Josh Ferge",
        },
        "contexts": {
            "feedback": {
                "contact_email": "josh.ferge@sentry.io",
                "name": "Josh Ferge",
                "message": "great website",
                "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
                "associated_event_id": "abcdefg",
            },
        },
        "breadcrumbs": [],
        "platform": "javascript",
    }
    create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    assert mock_produce_occurrence_to_kafka.call_count == 0
    assert Group.objects.count() == 0


@django_db_all
def test_create_feedback_tags(default_project, mock_produce_occurrence_to_kafka) -> None:
    """We want to surface these tags in the UI. We also use user.email for alert conditions."""
    event = mock_feedback_event(default_project.id)
    event["user"]["email"] = "josh.ferge@sentry.io"
    event["contexts"]["feedback"]["contact_email"] = "andrew@sentry.io"
    event["contexts"]["trace"] = {"trace_id": "abc123"}
    event_id = "a" * 32
    event["contexts"]["feedback"]["associated_event_id"] = event_id
    create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    assert mock_produce_occurrence_to_kafka.call_count == 1
    produced_event = mock_produce_occurrence_to_kafka.call_args.kwargs["event_data"]
    tags = produced_event["tags"]
    assert tags["user.email"] == "josh.ferge@sentry.io"

    # Uses feedback contact_email if user context doesn't have one
    del event["user"]["email"]
    create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    assert mock_produce_occurrence_to_kafka.call_count == 2  # includes last feedback
    produced_event = mock_produce_occurrence_to_kafka.call_args.kwargs["event_data"]
    tags = produced_event["tags"]
    assert tags["user.email"] == "andrew@sentry.io"

    # Adds associated_event_id and has_linked_error to tags
    assert tags["associated_event_id"] == event_id
    assert tags["has_linked_error"] == "true"

    # Adds release to tags
    assert tags["release"] == "frontend@daf1316f209d961443664cd6eb4231ca154db502"


@django_db_all
def test_create_feedback_tags_no_associated_event_id(
    default_project, mock_produce_occurrence_to_kafka
):
    event = mock_feedback_event(default_project.id, dt=datetime.now(UTC))
    create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    assert mock_produce_occurrence_to_kafka.call_count == 1
    produced_event = mock_produce_occurrence_to_kafka.call_args.kwargs["event_data"]
    tags = produced_event["tags"]

    # No associated_event_id in tags and has_linked_error is false
    assert tags.get("associated_event_id") is None
    assert tags["has_linked_error"] == "false"


@django_db_all
def test_create_feedback_tags_skips_email_if_empty(
    default_project, mock_produce_occurrence_to_kafka
) -> None:
    event = mock_feedback_event(default_project.id)
    event["user"].pop("email", None)
    event["contexts"]["feedback"].pop("contact_email", None)
    create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    assert mock_produce_occurrence_to_kafka.call_count == 1
    produced_event = mock_produce_occurrence_to_kafka.call_args.kwargs["event_data"]
    tags = produced_event["tags"]
    assert "user.email" not in tags


@django_db_all
@pytest.mark.parametrize("spam_enabled", (True, False))
@patch("sentry.feedback.usecases.ingest.create_feedback.spam_detection_enabled")
@patch("sentry.feedback.usecases.ingest.create_feedback.is_spam_seer", return_value=False)
def test_create_feedback_filters_large_message(
    mock_is_spam_seer,
    mock_spam_detection_enabled,
    default_project,
    mock_produce_occurrence_to_kafka,
    spam_enabled,
    set_sentry_option,
):
    """Large messages are filtered before spam detection and producing to kafka."""
    mock_spam_detection_enabled.return_value = spam_enabled

    with set_sentry_option("feedback.message.max-size", 5000):
        event = mock_feedback_event(default_project.id)
        event["contexts"]["feedback"]["message"] = "a" * 7007
        create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

        assert mock_is_spam_seer.call_count == 0
        assert mock_produce_occurrence_to_kafka.call_count == 0


@django_db_all
def test_create_feedback_evidence_source(default_project, mock_produce_occurrence_to_kafka) -> None:
    """We need this evidence field in post process, to determine if we should send alerts."""
    event = mock_feedback_event(default_project.id)
    source = FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
    create_feedback_issue(event, default_project, source)

    assert mock_produce_occurrence_to_kafka.call_count == 1
    evidence = mock_produce_occurrence_to_kafka.call_args.kwargs["occurrence"].evidence_data
    assert evidence["source"] == source.value


@django_db_all
def test_create_feedback_release(default_project, mock_produce_occurrence_to_kafka) -> None:
    event = mock_feedback_event(default_project.id)
    create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    assert mock_produce_occurrence_to_kafka.call_count == 1
    produced_event = mock_produce_occurrence_to_kafka.call_args.kwargs["event_data"]
    assert produced_event.get("release") is not None
    assert produced_event.get("release") == "frontend@daf1316f209d961443664cd6eb4231ca154db502"


@django_db_all
def test_create_feedback_issue_updates_project_flag(default_project) -> None:
    event = mock_feedback_event(default_project.id, dt=datetime.now(UTC))

    with (
        patch(
            "sentry.receivers.onboarding.record_first_feedback",  # autospec=True
        ) as mock_record_first_feedback,
        patch(
            "sentry.receivers.onboarding.record_first_new_feedback",  # autospec=True
        ) as mock_record_first_new_feedback,
    ):
        first_feedback_received.connect(mock_record_first_feedback, weak=False)
        first_new_feedback_received.connect(mock_record_first_new_feedback, weak=False)

    create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    default_project.refresh_from_db()
    assert mock_record_first_feedback.call_count == 1
    assert mock_record_first_new_feedback.call_count == 1

    assert default_project.flags.has_feedbacks
    assert default_project.flags.has_new_feedbacks


@django_db_all
@patch("sentry.feedback.usecases.ingest.create_feedback.get_feedback_title")
def test_create_feedback_issue_title(
    mock_get_feedback_title,
    default_project,
    mock_produce_occurrence_to_kafka,
) -> None:
    """Test that create_feedback_issue uses the formatted feedback message title when AI titles are disabled."""
    long_message = "This is a very long feedback message that describes multiple issues with the application including performance problems, UI bugs, and various other concerns that users are experiencing"

    with Feature({"organizations:user-feedback-ai-titles": False}):
        event = mock_feedback_event(default_project.id)
        event["contexts"]["feedback"]["message"] = long_message

        mock_get_feedback_title.return_value = (
            "This is a very long feedback message that describes multiple..."
        )

        create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

        mock_get_feedback_title.assert_called_once_with(
            long_message, default_project.organization_id, False
        )
        assert mock_produce_occurrence_to_kafka.call_count == 1
        call_args = mock_produce_occurrence_to_kafka.call_args
        occurrence = call_args[1]["occurrence"]
        assert (
            occurrence.issue_title
            == "User Feedback: This is a very long feedback message that describes multiple..."
        )
        assert (
            occurrence.evidence_data["summary"]
            == "This is a very long feedback message that describes multiple..."
        )


@django_db_all
@patch("sentry.feedback.usecases.ingest.create_feedback.get_feedback_title")
def test_create_feedback_issue_title_from_seer(
    mock_get_feedback_title,
    default_project,
    mock_produce_occurrence_to_kafka,
    mock_has_seer_access,
) -> None:
    """Test that create_feedback_issue uses the generated title from Seer."""
    mock_has_seer_access.return_value = True
    with Feature({"organizations:user-feedback-ai-titles": True}):
        event = mock_feedback_event(default_project.id)
        event["contexts"]["feedback"]["message"] = "The login button is broken and the UI is slow"

        mock_get_feedback_title.return_value = "Login Button Issue"

        create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

        mock_get_feedback_title.assert_called_once_with(
            "The login button is broken and the UI is slow", default_project.organization_id, True
        )

        assert mock_produce_occurrence_to_kafka.call_count == 1
        occurrence = mock_produce_occurrence_to_kafka.call_args.kwargs["occurrence"]
        assert occurrence.issue_title == "User Feedback: Login Button Issue"
        assert occurrence.evidence_data["summary"] == "Login Button Issue"


@django_db_all
@patch("sentry.feedback.usecases.title_generation.make_signed_seer_api_request")
def test_create_feedback_issue_title_does_not_throw(
    mock_make_signed_seer_api_request,
    default_project,
    mock_produce_occurrence_to_kafka,
    mock_has_seer_access,
) -> None:
    """Test that the title falls back to message-based title if Seer call fails with network error."""
    mock_has_seer_access.return_value = True
    with Feature(
        {
            "organizations:user-feedback-ai-titles": True,
        }
    ):
        event = mock_feedback_event(default_project.id)
        event["contexts"]["feedback"]["message"] = "The login button is broken and the UI is slow"

        mock_make_signed_seer_api_request.side_effect = Exception("Network Error")
        create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)


@django_db_all
@patch("sentry.feedback.usecases.title_generation.make_signed_seer_api_request")
def test_create_feedback_issue_title_from_seer_skips_if_spam(
    mock_make_signed_seer_api_request,
    default_project,
    mock_produce_occurrence_to_kafka,
    mock_has_seer_access,
) -> None:
    """Test title generation endpoint is not called if marked as spam."""
    mock_has_seer_access.return_value = True
    with (
        patch("sentry.feedback.usecases.ingest.create_feedback.is_spam_seer", return_value=True),
        # XXX: this is not ideal to mock, we should refactor spam and AI processors to their own unit testable function.
        patch(
            "sentry.feedback.usecases.ingest.create_feedback.spam_detection_enabled",
            return_value=True,
        ),
        Feature(
            {
                "organizations:user-feedback-ai-titles": True,
            }
        ),
    ):
        event = mock_feedback_event(default_project.id)
        create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)
        mock_make_signed_seer_api_request.assert_not_called()


@django_db_all
def test_create_feedback_adds_ai_labels(
    default_project, mock_produce_occurrence_to_kafka, mock_has_seer_access
) -> None:
    """Test that create_feedback_issue adds AI labels to tags when label generation succeeds."""
    mock_has_seer_access.return_value = True
    with Feature(
        {
            "organizations:user-feedback-ai-categorization": True,
        }
    ):
        event = mock_feedback_event(default_project.id)
        event["contexts"]["feedback"]["message"] = "The login button is broken and the UI is slow"

        # This assumes that the maximum number of labels allowed is greater than 3
        def mock_generate_labels(*args, **kwargs):
            return ["User Interface", "Authentication", "Performance"]

        with patch(
            "sentry.feedback.usecases.ingest.create_feedback.generate_labels",
            mock_generate_labels,
        ):
            create_feedback_issue(
                event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        assert mock_produce_occurrence_to_kafka.call_count == 1
        produced_event = mock_produce_occurrence_to_kafka.call_args.kwargs["event_data"]
        tags = produced_event["tags"]

        ai_labels = [
            value for key, value in tags.items() if key.startswith(f"{AI_LABEL_TAG_PREFIX}.label.")
        ]

        expected_labels = ["Authentication", "Performance", "User Interface"]

        assert len(ai_labels) == 3
        assert set(ai_labels) == set(expected_labels)
        assert tags[f"{AI_LABEL_TAG_PREFIX}.labels"] == json.dumps(expected_labels)


@django_db_all
def test_create_feedback_handles_label_generation_errors(
    default_project, mock_produce_occurrence_to_kafka, mock_has_seer_access
) -> None:
    """Test that create_feedback_issue continues to work even when generate_labels raises an error."""
    mock_has_seer_access.return_value = True
    with Feature(
        {
            "organizations:user-feedback-ai-categorization": True,
        }
    ):
        event = mock_feedback_event(default_project.id)
        event["contexts"]["feedback"]["message"] = "This is a valid feedback message"

        # Mock generate_labels to raise an exception
        def mock_generate_labels(*args, **kwargs):
            raise Exception("Label generation failed")

        with patch(
            "sentry.feedback.usecases.ingest.create_feedback.generate_labels",
            mock_generate_labels,
        ):
            # This should not raise an exception and should still create the feedback
            create_feedback_issue(
                event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        # Verify that the feedback was still created successfully
        assert mock_produce_occurrence_to_kafka.call_count == 1

        produced_event = mock_produce_occurrence_to_kafka.call_args.kwargs["event_data"]
        tags = produced_event["tags"]

        ai_labels = [tag for tag in tags.keys() if tag.startswith(f"{AI_LABEL_TAG_PREFIX}.label.")]
        assert len(ai_labels) == 0
        assert f"{AI_LABEL_TAG_PREFIX}.labels" not in tags


@django_db_all
def test_create_feedback_truncates_ai_labels_max_list_length(
    default_project, mock_produce_occurrence_to_kafka, mock_has_seer_access
) -> None:
    """Test that create_feedback_issue truncates AI labels when more than MAX_AI_LABELS are returned. If the list of labels is longer than MAX_AI_LABELS_JSON_LENGTH characters, the list is truncated in this test to match the intended behaviour."""
    mock_has_seer_access.return_value = True
    with Feature(
        {
            "organizations:user-feedback-ai-categorization": True,
        }
    ):
        event = mock_feedback_event(default_project.id)
        event["contexts"]["feedback"]["message"] = (
            "This is a very complex feedback with many issues"
        )

        alphabet = "abcdefghijklmnopqrstuvwxyz"

        # Mock generate_labels to return more than MAX_AI_LABELS labels
        # The labels should be sorted alphabetically, so don't store numbers, instead use letters
        def mock_generate_labels(*args, **kwargs):
            return [f"{alphabet[i]}" for i in range(MAX_AI_LABELS + 5)]

        with patch(
            "sentry.feedback.usecases.ingest.create_feedback.generate_labels",
            mock_generate_labels,
        ):
            create_feedback_issue(
                event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        assert mock_produce_occurrence_to_kafka.call_count == 1

        # Don't use ai_labels since we don't rely on dict order
        expected_labels = [f"{alphabet[i]}" for i in range(MAX_AI_LABELS)]

        # Truncate the labels so the serialized list is within the allowed length
        while len(json.dumps(expected_labels)) > MAX_AI_LABELS_JSON_LENGTH:
            expected_labels.pop()

        labels_list_length = min(len(expected_labels), MAX_AI_LABELS)

        produced_event = mock_produce_occurrence_to_kafka.call_args.kwargs["event_data"]
        tags = produced_event["tags"]

        ai_labels = [
            value for key, value in tags.items() if key.startswith(f"{AI_LABEL_TAG_PREFIX}.label.")
        ]
        assert len(ai_labels) == labels_list_length, (
            "Should be truncated to exactly labels_list_length"
        )

        for i in range(labels_list_length):
            assert tags[f"{AI_LABEL_TAG_PREFIX}.label.{i}"] == expected_labels[i]

        assert tags[f"{AI_LABEL_TAG_PREFIX}.labels"] == json.dumps(expected_labels)

        # Verify that labels beyond labels_list_length are not present
        for i in range(labels_list_length, labels_list_length + 5):
            assert f"{AI_LABEL_TAG_PREFIX}.label.{i}" not in tags


@django_db_all
def test_create_feedback_truncates_ai_labels_max_json_length(
    default_project, mock_produce_occurrence_to_kafka, mock_has_seer_access
) -> None:
    """Test that create_feedback_issue truncates AI labels when the serialized list of labels is longer than MAX_AI_LABELS_JSON_LENGTH characters."""
    mock_has_seer_access.return_value = True
    with Feature(
        {
            "organizations:user-feedback-ai-categorization": True,
        }
    ):
        event = mock_feedback_event(default_project.id)

        event["contexts"]["feedback"]["message"] = (
            "This is a very complex feedback with many issues"
        )

        # The serialized list of labels should be longer than MAX_AI_LABELS_JSON_LENGTH characters, so we should only take the first item
        def mock_generate_labels(*args, **kwargs):
            return ["a" * (MAX_AI_LABELS_JSON_LENGTH - 50)] * 100

        with patch(
            "sentry.feedback.usecases.ingest.create_feedback.generate_labels",
            mock_generate_labels,
        ):
            create_feedback_issue(
                event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        assert mock_produce_occurrence_to_kafka.call_count == 1

        produced_event = mock_produce_occurrence_to_kafka.call_args.kwargs["event_data"]
        tags = produced_event["tags"]

        ai_labels = [
            value for key, value in tags.items() if key.startswith(f"{AI_LABEL_TAG_PREFIX}.label.")
        ]

        assert len(ai_labels) == 1
        assert tags[f"{AI_LABEL_TAG_PREFIX}.label.0"] == "a" * (MAX_AI_LABELS_JSON_LENGTH - 50)
        assert tags[f"{AI_LABEL_TAG_PREFIX}.labels"] == json.dumps(
            ["a" * (MAX_AI_LABELS_JSON_LENGTH - 50)]
        )
