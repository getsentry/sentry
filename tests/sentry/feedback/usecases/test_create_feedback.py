from __future__ import annotations

from typing import Any
from unittest.mock import Mock

import pytest

from sentry.feedback.usecases.create_feedback import (
    FeedbackCreationSource,
    create_feedback_issue,
    fix_for_issue_platform,
    validate_issue_platform_event_schema,
)
from sentry.testutils.pytest.fixtures import django_db_all


@pytest.fixture
def mock_produce_occurrence_to_kafka(monkeypatch):
    mock = Mock()
    monkeypatch.setattr(
        "sentry.feedback.usecases.create_feedback.produce_occurrence_to_kafka", mock
    )
    return mock


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
    create_feedback_issue(event, default_project, FeedbackCreationSource.NEW_FEEDBACK_ENVELOPE)

    assert mock_produce_occurrence_to_kafka.call_count == 0
