from __future__ import annotations

import time
from typing import Any
from unittest.mock import Mock

import pytest
from openai.types.chat.chat_completion import ChatCompletion, Choice
from openai.types.chat.chat_completion_message import ChatCompletionMessage

from sentry.feedback.usecases.create_feedback import (
    FeedbackCreationSource,
    create_feedback_issue,
    fix_for_issue_platform,
    validate_issue_platform_event_schema,
)
from sentry.models.group import GroupStatus
from sentry.testutils.helpers import Feature
from sentry.testutils.pytest.fixtures import django_db_all


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
        set_sentry_option("feedback.spam-detection-actions", True),
    ):
        yield


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
def test_create_feedback_spam_detection_adds_field(
    default_project,
    mock_produce_occurrence_to_kafka,
    input_message,
    expected_result,
    monkeypatch,
    feature_flag,
):
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

        def dummy_response(*args, **kwargs):
            return ChatCompletion(
                id="test",
                choices=[
                    Choice(
                        index=0,
                        message=ChatCompletionMessage(
                            content=(
                                "Junk"
                                if kwargs["messages"][1]["content"] == "This is definitely spam"
                                else "Not Junk"
                            ),
                            role="assistant",
                        ),
                        finish_reason="stop",
                    )
                ],
                created=time.time(),
                model="gpt3.5-trubo",
                object="chat.completion",
            )

        mock_openai = Mock()
        mock_openai().chat.completions.create = dummy_response

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
                == GroupStatus.RESOLVED
            )

        if not (expected_result and feature_flag):
            assert mock_produce_occurrence_to_kafka.call_count == 1


@django_db_all
def test_create_feedback_spam_detection_option_false(
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

        def dummy_response(*args, **kwargs):
            return ChatCompletion(
                id="test",
                choices=[
                    Choice(
                        index=0,
                        message=ChatCompletionMessage(
                            content=(
                                "Junk"
                                if kwargs["messages"][1]["content"] == "This is definitely spam"
                                else "Not Junk"
                            ),
                            role="assistant",
                        ),
                        finish_reason="stop",
                    )
                ],
                created=time.time(),
                model="gpt3.5-trubo",
                object="chat.completion",
            )

        mock_openai = Mock()
        mock_openai().chat.completions.create = dummy_response

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
