from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import Mock, patch

import pytest
import responses
from django.conf import settings

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
from tests.sentry.feedback import create_dummy_openai_response, mock_feedback_event


def mock_seer_response(**kwargs) -> None:
    """Use with @responses.activate to mock Seer API responses."""
    responses.add(
        responses.POST,
        f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/feedback/title",
        **kwargs,
    )


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
    "input_message, expected_result, feature_flag",
    [
        ("This is definitely spam", "True", True),
        ("Valid feedback message", None, True),
        ("This is definitely spam", None, False),
        ("Valid feedback message", None, False),
    ],
)
def test_create_feedback_spam_detection_produce_to_kafka(
    default_project,
    mock_produce_occurrence_to_kafka,
    input_message,
    expected_result,
    feature_flag,
):
    with Feature({"organizations:user-feedback-spam-ingest": feature_flag}):
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
                    "message": input_message,
                    "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                    "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
                },
            },
            "breadcrumbs": [],
            "platform": "javascript",
        }

        mock_openai = Mock()
        mock_openai().chat.completions.create = create_dummy_openai_response

        with patch("sentry.llm.providers.openai.OpenAI", mock_openai):
            create_feedback_issue(
                event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        # Check if the 'is_spam' evidence in the Kafka message matches the expected result
        is_spam_evidence = [
            evidence.value
            for evidence in mock_produce_occurrence_to_kafka.call_args_list[0]
            .kwargs["occurrence"]
            .evidence_display
            if evidence.name == "is_spam"
        ]
        found_is_spam = is_spam_evidence[0] if is_spam_evidence else None
        assert (
            found_is_spam == expected_result
        ), f"Expected {expected_result} but found {found_is_spam} for {input_message} and feature flag {feature_flag}"

        if expected_result and feature_flag:
            assert (
                mock_produce_occurrence_to_kafka.call_args_list[1]
                .kwargs["status_change"]
                .new_status
                == GroupStatus.IGNORED
            )

        if not (expected_result and feature_flag):
            assert mock_produce_occurrence_to_kafka.call_count == 1


@django_db_all
def test_create_feedback_spam_detection_project_option_false(
    default_project,
    mock_produce_occurrence_to_kafka,
):
    default_project.update_option("sentry:feedback_ai_spam_detection", False)

    with Feature({"organizations:user-feedback-spam-ingest": True}):
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
                    "message": "This is definitely spam",
                    "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                    "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
                },
            },
            "breadcrumbs": [],
            "platform": "javascript",
        }

        mock_openai = Mock()
        mock_openai().chat.completions.create = create_dummy_openai_response

        with patch("sentry.llm.providers.openai.OpenAI", mock_openai):
            create_feedback_issue(
                event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        # Check if the 'is_spam' evidence in the Kafka message matches the expected result
        is_spam_evidence = [
            evidence.value
            for evidence in mock_produce_occurrence_to_kafka.call_args.kwargs[
                "occurrence"
            ].evidence_display
            if evidence.name == "is_spam"
        ]
        found_is_spam = is_spam_evidence[0] if is_spam_evidence else None
        assert found_is_spam is None


@django_db_all
def test_create_feedback_spam_detection_set_status_ignored(default_project) -> None:
    with Feature(
        {
            "organizations:user-feedback-spam-filter-actions": True,
            "organizations:user-feedback-spam-ingest": True,
        }
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
                    "message": "This is definitely spam",
                    "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                    "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
                },
            },
            "breadcrumbs": [],
            "platform": "javascript",
        }

        mock_openai = Mock()
        mock_openai().chat.completions.create = create_dummy_openai_response

        with patch("sentry.llm.providers.openai.OpenAI", mock_openai):
            create_feedback_issue(
                event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
            )

        group = Group.objects.get()
        assert group.status == GroupStatus.IGNORED
        assert group.substatus == GroupSubStatus.FOREVER


@django_db_all
def test_create_feedback_adds_associated_event_id(
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
    event = mock_feedback_event(default_project.id, datetime.now(UTC))
    create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    assert mock_produce_occurrence_to_kafka.call_count == 1
    produced_event = mock_produce_occurrence_to_kafka.call_args.kwargs["event_data"]
    tags = produced_event["tags"]

    # No associated_event_id in tags and has_linked_error is false
    assert tags.get("associated_event_id") is None
    assert tags["has_linked_error"] == "false"


@django_db_all
def test_create_feedback_tags_skips_if_empty(
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
def test_create_feedback_filters_large_message(
    default_project, mock_produce_occurrence_to_kafka, set_sentry_option, spam_enabled
):
    """Large messages are filtered before spam detection and producing to kafka."""
    features = (
        {
            "organizations:user-feedback-spam-ingest": True,
        }
        if spam_enabled
        else {}
    )

    with (
        patch("sentry.llm.usecases.complete_prompt") as mock_complete_prompt,
        Feature(features),
        set_sentry_option("feedback.message.max-size", 4096),
    ):
        event = mock_feedback_event(default_project.id)
        event["contexts"]["feedback"]["message"] = "a" * 7007
        create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    assert mock_complete_prompt.call_count == 0
    assert mock_produce_occurrence_to_kafka.call_count == 0


@django_db_all
def test_create_feedback_evidence_has_source(
    default_project, mock_produce_occurrence_to_kafka
) -> None:
    """We need this evidence field in post process, to determine if we should send alerts."""
    event = mock_feedback_event(default_project.id)
    source = FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
    create_feedback_issue(event, default_project, source)

    assert mock_produce_occurrence_to_kafka.call_count == 1
    evidence = mock_produce_occurrence_to_kafka.call_args.kwargs["occurrence"].evidence_data
    assert evidence["source"] == source.value


@django_db_all
def test_create_feedback_evidence_has_spam(
    default_project, mock_produce_occurrence_to_kafka
) -> None:
    """We need this evidence field in post process, to determine if we should send alerts."""
    default_project.update_option("sentry:feedback_ai_spam_detection", True)

    with (
        patch("sentry.feedback.usecases.ingest.create_feedback.is_spam", return_value=True),
        Feature({"organizations:user-feedback-spam-ingest": True}),
    ):
        event = mock_feedback_event(default_project.id)
        source = FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
        create_feedback_issue(event, default_project, source)

    assert mock_produce_occurrence_to_kafka.call_count == 2  # second call is status change
    evidence = mock_produce_occurrence_to_kafka.call_args_list[0].kwargs["occurrence"].evidence_data
    assert evidence["is_spam"] is True


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
    event = mock_feedback_event(default_project.id, datetime.now(UTC))

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
def test_create_feedback_issue_title(default_project, mock_produce_occurrence_to_kafka) -> None:
    """Test that create_feedback_issue uses the formatted feedback message title."""
    long_message = "This is a very long feedback message that describes multiple issues with the application including performance problems, UI bugs, and various other concerns that users are experiencing"

    with Feature({"organizations:user-feedback-ai-titles": False}):
        event = mock_feedback_event(default_project.id)
        event["contexts"]["feedback"]["message"] = long_message

        create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

        assert mock_produce_occurrence_to_kafka.call_count == 1

        call_args = mock_produce_occurrence_to_kafka.call_args
        occurrence = call_args[1]["occurrence"]

        expected_title = (
            "User Feedback: This is a very long feedback message that describes multiple..."
        )
        assert occurrence.issue_title == expected_title


@django_db_all
@responses.activate
def test_create_feedback_issue_title_from_seer(
    default_project, mock_produce_occurrence_to_kafka
) -> None:
    """Test that create_feedback_issue uses the generated title from Seer."""
    with Feature(
        {
            "organizations:gen-ai-features": True,
            "organizations:user-feedback-ai-titles": True,
        }
    ):
        event = mock_feedback_event(default_project.id)
        event["contexts"]["feedback"]["message"] = "The login button is broken and the UI is slow"

        mock_seer_response(
            status=200,
            body='{"title": "Login Button Issue"}',
        )
        create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

        assert mock_produce_occurrence_to_kafka.call_count == 1
        occurrence = mock_produce_occurrence_to_kafka.call_args.kwargs["occurrence"]
        assert occurrence.issue_title == "User Feedback: Login Button Issue"


@django_db_all
@responses.activate
def test_create_feedback_issue_title_from_seer_fallback(
    default_project, mock_produce_occurrence_to_kafka
) -> None:
    """Test that the title falls back to message-based title if Seer call fails."""
    with Feature(
        {
            "organizations:gen-ai-features": True,
            "organizations:user-feedback-ai-titles": True,
        }
    ):
        event = mock_feedback_event(default_project.id)
        event["contexts"]["feedback"]["message"] = "The login button is broken and the UI is slow"

        mock_seer_response(body=Exception("Network Error"))
        create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

        assert mock_produce_occurrence_to_kafka.call_count == 1
        occurrence = mock_produce_occurrence_to_kafka.call_args.kwargs["occurrence"]
        assert (
            occurrence.issue_title == "User Feedback: The login button is broken and the UI is slow"
        )


@django_db_all
@responses.activate
def test_create_feedback_issue_title_from_seer_none(
    default_project, mock_produce_occurrence_to_kafka
) -> None:
    """Test that the title falls back to message-based title if Seer call returns None."""
    with Feature(
        {
            "organizations:gen-ai-features": True,
            "organizations:user-feedback-ai-titles": True,
        }
    ):
        event = mock_feedback_event(default_project.id)
        event["contexts"]["feedback"]["message"] = "The login button is broken and the UI is slow"

        mock_seer_response(
            status=200,
            body='{"title": ""}',
        )
        create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

        assert mock_produce_occurrence_to_kafka.call_count == 1
        occurrence = mock_produce_occurrence_to_kafka.call_args.kwargs["occurrence"]
        assert (
            occurrence.issue_title == "User Feedback: The login button is broken and the UI is slow"
        )


@django_db_all
def test_create_feedback_adds_ai_labels(default_project, mock_produce_occurrence_to_kafka) -> None:
    """Test that create_feedback_issue adds AI labels to tags when label generation succeeds."""
    with Feature(
        {
            "organizations:user-feedback-ai-categorization": True,
            "organizations:gen-ai-features": True,
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
    default_project, mock_produce_occurrence_to_kafka
) -> None:
    """Test that create_feedback_issue continues to work even when generate_labels raises an error."""
    with Feature(
        {
            "organizations:user-feedback-ai-categorization": True,
            "organizations:gen-ai-features": True,
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
    default_project, mock_produce_occurrence_to_kafka
) -> None:
    """Test that create_feedback_issue truncates AI labels when more than MAX_AI_LABELS are returned. If the list of labels is longer than MAX_AI_LABELS_JSON_LENGTH characters, the list is truncated in this test to match the intended behaviour."""
    with Feature(
        {
            "organizations:user-feedback-ai-categorization": True,
            "organizations:gen-ai-features": True,
        }
    ):
        event = mock_feedback_event(default_project.id)
        event["contexts"]["feedback"][
            "message"
        ] = "This is a very complex feedback with many issues"

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
        assert (
            len(ai_labels) == labels_list_length
        ), "Should be truncated to exactly labels_list_length"

        for i in range(labels_list_length):
            assert tags[f"{AI_LABEL_TAG_PREFIX}.label.{i}"] == expected_labels[i]

        assert tags[f"{AI_LABEL_TAG_PREFIX}.labels"] == json.dumps(expected_labels)

        # Verify that labels beyond labels_list_length are not present
        for i in range(labels_list_length, labels_list_length + 5):
            assert f"{AI_LABEL_TAG_PREFIX}.label.{i}" not in tags


@django_db_all
def test_create_feedback_truncates_ai_labels_max_json_length(
    default_project, mock_produce_occurrence_to_kafka
) -> None:
    """Test that create_feedback_issue truncates AI labels when the serialized list of labels is longer than MAX_AI_LABELS_JSON_LENGTH characters."""
    with Feature(
        {
            "organizations:user-feedback-ai-categorization": True,
            "organizations:gen-ai-features": True,
        }
    ):
        event = mock_feedback_event(default_project.id)

        event["contexts"]["feedback"][
            "message"
        ] = "This is a very complex feedback with many issues"

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
