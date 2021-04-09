import pytest

from sentry.testutils.helpers import Feature


@pytest.fixture(autouse=True)
def hierarchical_grouping_features():
    with Feature({"organizations:grouping-tree-ui": True}):
        yield


@pytest.fixture(autouse=True)
def auto_login(settings, client, default_user):
    assert client.login(username=default_user.username, password="admin")


@pytest.fixture
def store_stacktrace(default_project, factories):
    default_project.update_option("sentry:grouping_config", "mobile:2021-02-12")

    def inner(functions):
        event = {
            "exception": {
                "values": [
                    {
                        "type": "ZeroDivisionError",
                        "stacktrace": {"frames": [{"function": f} for f in functions]},
                    }
                ]
            }
        }

        return factories.store_event(data=event, project_id=default_project.id)

    return inner


@pytest.mark.django_db
@pytest.mark.snuba
def test_basic(client, default_project, store_stacktrace, default_user, reset_snuba):
    def _check_merged():
        event1 = store_stacktrace(["foo", "bar", "baz"])
        event2 = store_stacktrace(["foo", "bam", "baz"])

        assert event1.group_id == event2.group_id

        url = f"/api/0/issues/{event1.group_id}/hashes/split/"
        response = client.get(url, format="json")
        assert response.status_code == 200
        assert response.data == [
            {
                "childId": "3d433234e3f52665a03e87b46e423534",
                "childLabel": "bam | ...",
                "eventCount": 1,
                "id": "dc6e6375dcdf74132537129e6a182de7",
                "label": "baz",
                "latestEvent": response.data[0]["latestEvent"],
                "parentId": None,
            },
            {
                "childId": "ce6d941a9829057608a96725c201e636",
                "childLabel": "bar | ...",
                "eventCount": 1,
                "id": "dc6e6375dcdf74132537129e6a182de7",
                "label": "baz",
                "latestEvent": response.data[1]["latestEvent"],
                "parentId": None,
            },
        ]

        return event1.group_id

    group_id = _check_merged()

    response = client.put(
        f"/api/0/issues/{group_id}/hashes/split/?id=dc6e6375dcdf74132537129e6a182de7",
    )
    assert response.status_code == 200

    event1 = store_stacktrace(["foo", "bar", "baz"])
    event2 = store_stacktrace(["foo", "bam", "baz"])

    assert event1.group_id != event2.group_id

    response = client.get(f"/api/0/issues/{event1.group_id}/hashes/split/", format="json")
    assert response.status_code == 200
    assert response.data == [
        {
            "childId": "eeb8cfaa8b792f5dc0abbd3bd30f5e39",
            "childLabel": "<entire stacktrace>",
            "eventCount": 1,
            "id": "ce6d941a9829057608a96725c201e636",
            "label": "bar | ...",
            "latestEvent": response.data[0]["latestEvent"],
            "parentId": "dc6e6375dcdf74132537129e6a182de7",
            "parentLabel": "baz",
        }
    ]

    response = client.get(f"/api/0/issues/{event2.group_id}/hashes/split/", format="json")
    assert response.status_code == 200
    assert response.data == [
        {
            "childId": "e81cbeccec98c88097a40dd44ff20479",
            "childLabel": "<entire stacktrace>",
            "eventCount": 1,
            "id": "3d433234e3f52665a03e87b46e423534",
            "label": "bam | ...",
            "latestEvent": response.data[0]["latestEvent"],
            "parentId": "dc6e6375dcdf74132537129e6a182de7",
            "parentLabel": "baz",
        }
    ]

    response = client.delete(
        f"/api/0/issues/{event1.group_id}/hashes/split/?id=ce6d941a9829057608a96725c201e636",
    )
    assert response.status_code == 200
    response = client.delete(
        f"/api/0/issues/{event2.group_id}/hashes/split/?id=3d433234e3f52665a03e87b46e423534",
    )
    assert response.status_code == 200

    # TODO: When split/unsplit in Snuba is properly supported, we should also
    # see existing events moving.
    assert _check_merged() != group_id
