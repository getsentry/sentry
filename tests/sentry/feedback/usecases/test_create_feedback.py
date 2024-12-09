from __future__ import annotations

import time
from datetime import UTC, datetime
from typing import Any
from unittest.mock import Mock

import pytest
from openai.types.chat.chat_completion import ChatCompletion, Choice
from openai.types.chat.chat_completion_message import ChatCompletionMessage

from sentry.eventstore.models import Event
from sentry.feedback.usecases.create_feedback import (
    FeedbackCreationSource,
    create_feedback_issue,
    fix_for_issue_platform,
    is_in_feedback_denylist,
    shim_to_feedback,
    validate_issue_platform_event_schema,
)
from sentry.models.group import Group, GroupStatus
from sentry.testutils.helpers import Feature
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.group import GroupSubStatus


@pytest.fixture
def mock_produce_occurrence_to_kafka(monkeypatch):
    mock = Mock()
    monkeypatch.setattr(
        "sentry.feedback.usecases.create_feedback.produce_occurrence_to_kafka", mock
    )
    return mock


@pytest.fixture(autouse=True)
def llm_settings(set_sentry_option):
    with (
        set_sentry_option(
            "llm.provider.options",
            {"openai": {"models": ["gpt-4-turbo-1.0"], "options": {"api_key": "fake_api_key"}}},
        ),
        set_sentry_option(
            "llm.usecases.options",
            {"spamdetection": {"provider": "openai", "options": {"model": "gpt-4-turbo-1.0"}}},
        ),
    ):
        yield


def create_dummy_response(*args, **kwargs):
    return ChatCompletion(
        id="test",
        choices=[
            Choice(
                index=0,
                message=ChatCompletionMessage(
                    content=(
                        "spam"
                        if "this is definitely spam"
                        in kwargs["messages"][0][
                            "content"
                        ]  # assume make_input_prompt lower-cases the msg
                        else "not spam"
                    ),
                    role="assistant",
                ),
                finish_reason="stop",
            )
        ],
        created=int(time.time()),
        model="gpt3.5-trubo",
        object="chat.completion",
    )


def mock_feedback_event(project_id: int, dt: datetime):
    return {
        "project_id": project_id,
        "request": {
            "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
            },
        },
        "event_id": "56b08cf7852c42cbb95e4a6998c66ad6",
        "timestamp": dt.timestamp(),
        "received": dt.isoformat(),
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
                "message": "Testing!!",
                "replay_id": "3d621c61593c4ff9b43f8490a78ae18e",
                "url": "https://sentry.sentry.io/feedback/?statsPeriod=14d",
            },
        },
        "breadcrumbs": [],
        "platform": "javascript",
    }


def test_fix_for_issue_platform():
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


def test_corrected_still_works():
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


@django_db_all
def test_create_feedback_filters_unreal(default_project, mock_produce_occurrence_to_kafka):
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
    create_feedback_issue(event, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    assert mock_produce_occurrence_to_kafka.call_count == 0


@django_db_all
def test_create_feedback_filters_empty(default_project, mock_produce_occurrence_to_kafka):
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
    create_feedback_issue(event, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)
    create_feedback_issue(event_2, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

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
        event_no_context, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
    )
    create_feedback_issue(
        event_no_message, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
    )
    create_feedback_issue(
        event_no_feedback, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
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
    monkeypatch,
    feature_flag,
):
    with Feature({"organizations:user-feedback-spam-filter-actions": True}):

        with Feature({"organizations:user-feedback-spam-filter-ingest": feature_flag}):
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
            mock_openai().chat.completions.create = create_dummy_response

            monkeypatch.setattr("sentry.llm.providers.openai.OpenAI", mock_openai)

            create_feedback_issue(
                event, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
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
    monkeypatch,
):
    default_project.update_option("sentry:feedback_ai_spam_detection", False)

    with Feature({"organizations:user-feedback-spam-filter-ingest": True}):
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
        mock_openai().chat.completions.create = create_dummy_response

        monkeypatch.setattr("sentry.llm.providers.openai.OpenAI", mock_openai)

        create_feedback_issue(
            event, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
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
def test_create_feedback_spam_detection_set_status_ignored(
    default_project,
    monkeypatch,
):
    with Feature(
        {
            "organizations:user-feedback-spam-filter-actions": True,
            "organizations:user-feedback-spam-filter-ingest": True,
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
        mock_openai().chat.completions.create = create_dummy_response

        monkeypatch.setattr("sentry.llm.providers.openai.OpenAI", mock_openai)

        create_feedback_issue(
            event, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
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
    create_feedback_issue(event, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

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
def test_create_feedback_tags(default_project, mock_produce_occurrence_to_kafka):
    """We want to surface these tags in the UI. We also use user.email for alert conditions."""
    event = mock_feedback_event(default_project.id, datetime.now(UTC))
    event["user"]["email"] = "josh.ferge@sentry.io"
    event["contexts"]["feedback"]["contact_email"] = "andrew@sentry.io"
    event["contexts"]["trace"] = {"trace_id": "abc123"}
    create_feedback_issue(event, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    assert mock_produce_occurrence_to_kafka.call_count == 1
    produced_event = mock_produce_occurrence_to_kafka.call_args.kwargs["event_data"]
    tags = produced_event["tags"]
    assert tags["user.email"] == "josh.ferge@sentry.io"
    assert tags["trace.id"] == "abc123"

    # Uses feedback contact_email if user context doesn't have one
    del event["user"]["email"]
    create_feedback_issue(event, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    assert mock_produce_occurrence_to_kafka.call_count == 2  # includes last feedback
    produced_event = mock_produce_occurrence_to_kafka.call_args.kwargs["event_data"]
    tags = produced_event["tags"]
    assert tags["user.email"] == "andrew@sentry.io"


@django_db_all
def test_create_feedback_tags_skips_if_empty(default_project, mock_produce_occurrence_to_kafka):
    event = mock_feedback_event(default_project.id, datetime.now(UTC))
    event["user"].pop("email", None)
    event["contexts"]["feedback"].pop("contact_email", None)
    event["contexts"].pop("trace", None)
    create_feedback_issue(event, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    assert mock_produce_occurrence_to_kafka.call_count == 1
    produced_event = mock_produce_occurrence_to_kafka.call_args.kwargs["event_data"]
    tags = produced_event["tags"]
    assert "user.email" not in tags
    assert "trace.id" not in tags


@django_db_all
def test_create_feedback_large_message_truncated(
    default_project, mock_produce_occurrence_to_kafka, set_sentry_option
):
    """Large messages are truncated before producing to kafka."""
    with set_sentry_option("feedback.message.max-size", 4096):
        event = mock_feedback_event(default_project.id, datetime.now(UTC))
        event["contexts"]["feedback"]["message"] = "a" * 7007
        create_feedback_issue(
            event, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
        )

    kwargs = mock_produce_occurrence_to_kafka.call_args[1]
    assert len(kwargs["occurrence"].subtitle) == 4096


@django_db_all
def test_create_feedback_large_message_skips_spam_detection(
    default_project, set_sentry_option, monkeypatch
):
    """If spam is enabled, large messages are marked as spam without making an LLM request."""
    with (
        Feature(
            {
                "organizations:user-feedback-spam-filter-actions": True,
                "organizations:user-feedback-spam-filter-ingest": True,
            }
        ),
        set_sentry_option("feedback.message.max-size", 4096),
    ):

        event = mock_feedback_event(default_project.id, datetime.now(UTC))
        event["contexts"]["feedback"]["message"] = "a" * 7007

        mock_complete_prompt = Mock()
        monkeypatch.setattr("sentry.llm.usecases.complete_prompt", mock_complete_prompt)

        create_feedback_issue(
            event, default_project.id, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE
        )
        assert mock_complete_prompt.call_count == 0

        group = Group.objects.get()
        assert group.status == GroupStatus.IGNORED
        assert group.substatus == GroupSubStatus.FOREVER


"""
Unit tests for shim_to_feedback error cases. The typical behavior of this function is tested in
test_project_user_reports, test_post_process, and test_update_user_reports.
"""


@django_db_all
def test_shim_to_feedback_missing_event(default_project, monkeypatch):
    # Not allowing this since creating feedbacks with no environment (copied from the associated event) doesn't work well.
    mock_create_feedback_issue = Mock()
    monkeypatch.setattr(
        "sentry.feedback.usecases.create_feedback.create_feedback_issue", mock_create_feedback_issue
    )
    report_dict = {
        "name": "andrew",
        "email": "aliu@example.com",
        "comments": "Shim this",
        "event_id": "a" * 32,
        "level": "error",
    }
    shim_to_feedback(
        report_dict, None, default_project, FeedbackCreationSource.USER_REPORT_ENVELOPE  # type: ignore[arg-type]
    )
    # Error is handled:
    assert mock_create_feedback_issue.call_count == 0


@django_db_all
def test_shim_to_feedback_missing_fields(default_project, monkeypatch):
    # Email and comments are required to shim. Tests key errors are handled.
    mock_create_feedback_issue = Mock()
    monkeypatch.setattr(
        "sentry.feedback.usecases.create_feedback.create_feedback_issue", mock_create_feedback_issue
    )
    report_dict = {
        "name": "andrew",
        "event_id": "a" * 32,
        "level": "error",
    }
    event = Event(event_id="a" * 32, project_id=default_project.id)
    shim_to_feedback(
        report_dict, event, default_project, FeedbackCreationSource.USER_REPORT_ENVELOPE  # type: ignore[arg-type]
    )
    assert mock_create_feedback_issue.call_count == 0


@django_db_all
def test_denylist(set_sentry_option, default_project):
    with set_sentry_option(
        "feedback.organizations.slug-denylist", [default_project.organization.slug]
    ):
        assert is_in_feedback_denylist(default_project.organization) is True


@django_db_all
def test_denylist_not_in_list(set_sentry_option, default_project):
    with set_sentry_option("feedback.organizations.slug-denylist", ["not-in-list"]):
        assert is_in_feedback_denylist(default_project.organization) is False
