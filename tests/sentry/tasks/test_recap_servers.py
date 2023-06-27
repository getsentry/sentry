from unittest import mock

import pytest
import responses

from sentry import eventstore
from sentry.models import Organization, Project
from sentry.tasks.recap_servers import (
    RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY,
    RECAP_SERVER_OPTION_KEY,
    poll_project_recap_server,
    poll_recap_servers,
)
from sentry.utils import json

single_crash_payload = {
    "_links": {
        "self": {"href": "ApiBaseUrl/burp/137?field=stopReason"},
        "files": {"href": "ApiBaseUrl/burp/137/files", "custom": True},
    },
    "stopReason": "SEGFAULT",
    "detailedStackTrace": [
        {
            "sourceFile": "/usr/build/src/foo.c",
            "sourceLine": 42,
            "moduleName": "boot.bin",
            "moduleFingerprint": "iddqd",
            "moduleOffset": "0x1",
            "resolvedSymbol": "Foo::Run()+0x4",
            "absoluteAddress": "0xaa00bb4",
            "displayValue": "boot.bin!Foo::Update()+0x4",
        },
        {
            "sourceFile": "/usr/build/src/bar.c",
            "sourceLine": 1337,
            "moduleName": "boot.bin",
            "moduleFingerprint": "idkfa",
            "moduleOffset": "0x10",
            "resolvedSymbol": "Executor::Run()+0x30",
            "absoluteAddress": "0xbb11aa4",
            "displayValue": "boot.bin!Bar::Trigger()+0x30",
        },
    ],
}


@pytest.fixture()
def single_project():
    org = Organization.objects.create(slug="test-org")
    project = Project.objects.create(organization=org, slug="test-project")
    project.update_option(RECAP_SERVER_OPTION_KEY, "http://example.com")
    return project


@pytest.fixture()
def multiple_projects():
    org_one = Organization.objects.create(slug="test-org-one")
    org_one_project_one = Project.objects.create(organization=org_one, slug="test-project-one")
    org_one_project_one.update_option(RECAP_SERVER_OPTION_KEY, "http://example-one.com")
    org_one_project_two = Project.objects.create(organization=org_one, slug="test-project-two")
    org_one_project_two.update_option(RECAP_SERVER_OPTION_KEY, "http://example-two.com")
    Project.objects.create(organization=org_one, slug="test-project-three")  # no recap configured

    org_two = Organization.objects.create(slug="test-org-two")
    org_two_project_one = Project.objects.create(organization=org_two, slug="test-project-one")
    org_two_project_one.update_option(RECAP_SERVER_OPTION_KEY, "http://example-one.com")
    org_two_project_two = Project.objects.create(organization=org_two, slug="test-project-two")
    org_two_project_two.update_option(RECAP_SERVER_OPTION_KEY, "http://example-two.com")
    Project.objects.create(organization=org_two, slug="test-project-three")  # no recap configured

    return [org_one_project_one, org_one_project_two, org_two_project_one, org_two_project_two]


@mock.patch("sentry.tasks.recap_servers.poll_project_recap_server.delay")
@pytest.mark.django_db
def test_poll_recap_servers_no_matches(
    poll_project_recap_server,
    task_runner,
):
    Project.objects.create(
        organization=Organization.objects.create(slug="test-org"), slug="test-project-one"
    )

    with task_runner():
        poll_recap_servers()

    assert poll_project_recap_server.call_count == 0


@mock.patch("sentry.tasks.recap_servers.poll_project_recap_server.delay")
@pytest.mark.django_db
def test_poll_recap_servers_single_project(
    poll_project_recap_server,
    task_runner,
    single_project,
):
    with task_runner():
        poll_recap_servers()

    assert poll_project_recap_server.call_count == 1
    poll_project_recap_server.assert_has_calls([mock.call(single_project.id)], any_order=True)


@mock.patch("sentry.tasks.recap_servers.poll_project_recap_server.delay")
@pytest.mark.django_db
def test_poll_recap_servers_multiple_projects(
    poll_project_recap_server, task_runner, multiple_projects
):
    with task_runner():
        poll_recap_servers()

    assert poll_project_recap_server.call_count == 4
    poll_project_recap_server.assert_has_calls(
        [mock.call(project.id) for project in multiple_projects], any_order=True
    )


@pytest.mark.django_db
def test_poll_project_recap_server_incorrect_project(
    task_runner,
):
    with task_runner():
        poll_project_recap_server(1337)  # should not error


@pytest.mark.django_db
def test_poll_project_recap_server_missing_recap_url(task_runner, single_project):
    single_project.delete_option(RECAP_SERVER_OPTION_KEY)
    with task_runner():
        poll_project_recap_server(single_project.id)  # should not error


@pytest.mark.django_db
@mock.patch("sentry.tasks.recap_servers.store_crash")
@responses.activate
def test_poll_project_recap_server_initial_request(store_crash, task_runner, single_project):
    payload = {
        "results": 3,
        "_embedded": {
            "crash": [
                {"id": 1},
                {"id": 1337},
                {"id": 42},
            ]
        },
    }
    outgoing_recap_request = responses.add(
        method=responses.GET,
        url="http://example.com/rest/v1/crashes",
        body=json.dumps(payload),
        content_type="application/json",
    )

    assert single_project.get_option(RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY) is None

    with task_runner():
        poll_project_recap_server(single_project.id)

    assert outgoing_recap_request.call_count == 1
    assert store_crash.call_count == 3
    assert single_project.get_option(RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY) == 1337


@pytest.mark.django_db
@mock.patch("sentry.tasks.recap_servers.store_crash")
@responses.activate
def test_poll_project_recap_server_following_request(store_crash, task_runner, single_project):
    payload = {
        "results": 2,
        "_embedded": {
            "crash": [
                {"id": 1337},
                {"id": 42},
            ]
        },
    }
    # Encoded query: {8 TO *}
    outgoing_recap_request = responses.add(
        method=responses.GET,
        url="http://example.com/rest/v1/crashes;q=id:%7B8%20TO%20%2A%7D",
        body=json.dumps(payload),
        content_type="application/json",
    )
    assert single_project.update_option(RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY, 8)

    with task_runner():
        poll_project_recap_server(single_project.id)

    assert outgoing_recap_request.call_count == 1
    assert store_crash.call_count == 2
    assert single_project.get_option(RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY) == 1337


@pytest.mark.django_db
@responses.activate
def test_poll_recap_servers_store_crash(
    task_runner,
    single_project,
):
    crash_one = dict(single_crash_payload)
    crash_one["id"] = 1337
    crash_two = dict(single_crash_payload)
    crash_two["id"] = 42
    payload = {"results": 2, "_embedded": {"crash": [crash_one, crash_two]}}
    responses.add(
        method=responses.GET,
        url="http://example.com/rest/v1/crashes",
        body=json.dumps(payload),
        content_type="application/json",
    )

    with task_runner():
        poll_project_recap_server(single_project.id)

    events = eventstore.backend.get_events(
        eventstore.Filter(project_ids=[single_project.id]),
        tenant_ids={"referrer": "relay-test", "organization_id": 123},
    )
    events_tags = [event.tags for event in events]

    assert [
        ("crash_id", "42"),
        ("level", "error"),
        ("url", "http://example.com/rest/v1/crashes"),
    ] in events_tags
    assert [
        ("crash_id", "1337"),
        ("level", "error"),
        ("url", "http://example.com/rest/v1/crashes"),
    ] in events_tags
