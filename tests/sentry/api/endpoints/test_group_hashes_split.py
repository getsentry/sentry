import pytest

from sentry.testutils.helpers import Feature

pytestmark = pytest.mark.skip(reason="extremely flaky test")


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
    def _check_merged(seq):
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
                "eventCount": seq,
                "id": "dc6e6375dcdf74132537129e6a182de7",
                "label": "baz",
                "latestEvent": response.data[0]["latestEvent"],
                "parentId": None,
            },
            {
                "childId": "ce6d941a9829057608a96725c201e636",
                "childLabel": "bar | ...",
                "eventCount": seq,
                "id": "dc6e6375dcdf74132537129e6a182de7",
                "label": "baz",
                "latestEvent": response.data[1]["latestEvent"],
                "parentId": None,
            },
        ]

        return event1.group_id

    group_id = _check_merged(1)

    response = client.put(
        f"/api/0/issues/{group_id}/hashes/split/?id=dc6e6375dcdf74132537129e6a182de7",
    )
    assert response.status_code == 200

    event1 = store_stacktrace(["foo", "bar", "baz"])
    event2 = store_stacktrace(["foo", "bam", "baz"])

    assert event1.group_id != event2.group_id
    assert event1.group_id != group_id

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

    # TODO: Once we start moving events, the old group should probably no
    # longer exist.
    assert _check_merged(2) == group_id


@pytest.mark.django_db
@pytest.mark.snuba
def test_split_everything(client, default_project, store_stacktrace, default_user, reset_snuba):
    """
    We have two events in one group, one has a stacktrace that is a suffix of
    the other. This presents an edgecase where it is legitimate to split up the
    *last hash* of an event as that just happens to not be the last hash of
    some other event. In that case we need to ignore the split for events that
    don't have a next hash to group by.
    """

    event = store_stacktrace(["foo"])
    event2 = store_stacktrace(["bar", "foo"])
    assert event2.group_id == event.group_id

    assert event.data["hierarchical_hashes"] == ["bab925683e73afdb4dc4047397a7b36b"]

    url = f"/api/0/issues/{event.group_id}/hashes/split/"
    response = client.get(url, format="json")
    assert response.status_code == 200
    assert response.data == [
        {
            "childId": None,
            "eventCount": 1,
            "id": "bab925683e73afdb4dc4047397a7b36b",
            "label": "<entire stacktrace>",
            "latestEvent": response.data[0]["latestEvent"],
            "parentId": None,
        },
        {
            "childId": "aa1c4037371150958f9ea22adb110bbc",
            "eventCount": 1,
            "id": "bab925683e73afdb4dc4047397a7b36b",
            "label": "foo",
            "childLabel": "<entire stacktrace>",
            "latestEvent": response.data[1]["latestEvent"],
            "parentId": None,
        },
    ]

    response = client.put(
        f"/api/0/issues/{event.group_id}/hashes/split/?id=bab925683e73afdb4dc4047397a7b36b",
    )
    assert response.status_code == 200

    event3 = store_stacktrace(["foo"])
    assert event3.group_id == event.group_id

    event4 = store_stacktrace(["bar", "foo"])
    assert event4.group_id not in (event.group_id, event2.group_id, event3.group_id)
