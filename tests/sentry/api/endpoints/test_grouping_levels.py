import time

import pytest

from sentry.models import Group, GroupHash
from sentry.models.project import Project
from sentry.testutils.helpers import Feature
from sentry.testutils.silo import region_silo_test
from sentry.utils.json import prune_empty_keys
from sentry.utils.pytest.fixtures import django_db_all


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

    timestamp = time.time() - 3600

    def inner(functions, interface="exception", type="error", extra_event_data=None):
        nonlocal timestamp

        timestamp += 1

        event = {
            "timestamp": timestamp,
            interface: {
                "values": [
                    {
                        "type": "ZeroDivisionError",
                        "stacktrace": {"frames": [{"function": f} for f in functions]},
                    }
                ]
            },
            "type": type,
            **(extra_event_data or {}),
        }

        return factories.store_event(data=event, project_id=default_project.id)

    return inner


@pytest.fixture
def _render_all_previews(client):
    def inner(group: Group):
        rv = [f"group: {group.title}"]
        assert "finest_tree_label" not in group.data["metadata"]

        response = client.get(f"/api/0/issues/{group.id}/grouping/levels/", format="json")
        assert response.status_code == 200

        for level in response.data["levels"]:
            rv.append(f"level {level['id']}{level.get('isCurrent') and '*' or ''}")

            response = client.get(
                f"/api/0/issues/{group.id}/grouping/levels/{level['id']}/new-issues/", format="json"
            )

            assert response.status_code == 200

            rv.extend(
                f"{preview['hash']}: {preview['title']} ({preview['eventCount']})"
                for preview in response.data
            )

        return "\n".join(rv)

    return inner


@django_db_all
def test_error_missing_feature(client, default_project):
    group = Group.objects.create(project=default_project)

    with Feature({"organizations:grouping-tree-ui": False}):
        response = client.get(f"/api/0/issues/{group.id}/grouping/levels/", format="json")
        assert response.status_code == 403
        assert response.data["detail"]["code"] == "missing_feature"


@django_db_all
def test_error_no_events(client, default_project):
    group = Group.objects.create(project=default_project)

    response = client.get(f"/api/0/issues/{group.id}/grouping/levels/", format="json")
    assert response.status_code == 403
    assert response.data["detail"]["code"] == "no_events"


@region_silo_test(stable=True)
@django_db_all
@pytest.mark.snuba
def test_error_not_hierarchical(client, default_project, reset_snuba, factories):
    default_project.update_option("sentry:grouping_config", "mobile:2021-02-12")
    group = Group.objects.create(project=default_project)
    grouphash = GroupHash.objects.create(
        project=default_project, group=group, hash="d41d8cd98f00b204e9800998ecf8427e"
    )

    # we cannot run one of the other test_error testcases here because it would
    # populate Snuba caches. Then we would not be able to observe our write, at
    # least not within the same second we wrote.

    factories.store_event(
        data={"message": "hello world", "checksum": grouphash.hash}, project_id=default_project.id
    )

    response = client.get(f"/api/0/issues/{group.id}/grouping/levels/", format="json")
    assert response.status_code == 403
    assert response.data["detail"]["code"] == "issue_not_hierarchical"


@django_db_all
@pytest.mark.snuba
def test_error_project_not_hierarchical(client, default_organization, reset_snuba, factories):

    project = Project.objects.create(organization=default_organization, slug="test-project")
    project.update_option("sentry:grouping_config", "newstyle:2023-01-11")

    group = Group.objects.create(project=project)
    grouphash = GroupHash.objects.create(
        project=project, group=group, hash="d41d8cd98f00b204e9800998ecf8427e"
    )

    factories.store_event(
        data={"message": "hello world", "checksum": grouphash.hash}, project_id=project.id
    )

    response = client.get(f"/api/0/issues/{group.id}/grouping/levels/", format="json")
    assert response.status_code == 403
    assert response.data["detail"]["code"] == "project_not_hierarchical"


def _assert_tree_labels(event, functions):
    # This should really be its own test, but it is cheaper to run as part of an existing test.
    assert [
        prune_empty_keys(frame)
        for frame in event.data["exception"]["values"][0]["stacktrace"]["frames"]
    ] == [
        {
            "data": {
                "min_grouping_level": len(functions) - i - 1,
                "orig_in_app": -1,
            },
            "function": function,
            "in_app": False,
        }
        for i, function in enumerate(functions)
    ]

    assert (
        event.data["metadata"]["finest_tree_label"]
        == [{"function": function} for function in reversed(functions)][:2]
    )


@django_db_all
@pytest.mark.snuba
@region_silo_test(stable=True)
def test_downwards(default_project, store_stacktrace, reset_snuba, _render_all_previews):
    events = [
        # store events with a common crashing frame `foo` and diverging threadbases
        store_stacktrace(["bam", "baz2", "bar2", "foo"]),
        store_stacktrace(["baz", "bar", "foo"]),
        store_stacktrace(["baz2", "bar2", "foo"]),
        store_stacktrace(["bar3", "foo"]),
    ]

    # assert [e.title for e in events] == [
    # "ZeroDivisionError | foo | bar2",
    # "ZeroDivisionError | foo | bar",
    # "ZeroDivisionError | foo | bar2",
    # "ZeroDivisionError | foo | bar3",
    # ]

    assert len({e.group_id for e in events}) == 1

    _assert_tree_labels(events[0], ["bam", "baz2", "bar2", "foo"])
    _assert_tree_labels(events[1], ["baz", "bar", "foo"])
    _assert_tree_labels(events[2], ["baz2", "bar2", "foo"])
    _assert_tree_labels(events[3], ["bar3", "foo"])

    group = events[0].group

    assert (
        _render_all_previews(group)
        == """\
group: ZeroDivisionError
level 0*
bab925683e73afdb4dc4047397a7b36b: ZeroDivisionError | foo (4)
level 1
c8ef2dd3dedeed29b4b74b9c579eea1a: ZeroDivisionError | foo | bar2 (2)
64686dcd59e0cf97f34113e9d360541a: ZeroDivisionError | foo | bar3 (1)
aa1c4037371150958f9ea22adb110bbc: ZeroDivisionError | foo | bar (1)
level 2
8c0bbfebc194c7aa3e77e95436fd61e5: ZeroDivisionError | foo | bar2 | baz2 (2)
64686dcd59e0cf97f34113e9d360541a: ZeroDivisionError | foo | bar3 (1)
b8d08a573c62ca8c84de14c12c0e19fe: ZeroDivisionError | foo | bar | baz (1)
level 3
64686dcd59e0cf97f34113e9d360541a: ZeroDivisionError | foo | bar3 (1)
8c0bbfebc194c7aa3e77e95436fd61e5: ZeroDivisionError | foo | bar2 | baz2 (1)
b8d08a573c62ca8c84de14c12c0e19fe: ZeroDivisionError | foo | bar | baz (1)
b0505d7461a2e36c4a8235bb6c310a3b: ZeroDivisionError | foo | bar2 | baz2 | bam (1)\
"""
    )


@django_db_all
@pytest.mark.snuba
@region_silo_test(stable=True)
def test_upwards(default_project, store_stacktrace, reset_snuba, _render_all_previews):
    GroupHash.objects.create(
        project_id=default_project.id,
        hash="c8ef2dd3dedeed29b4b74b9c579eea1a",
        state=GroupHash.State.SPLIT,
        group_id=None,
    )

    GroupHash.objects.create(
        project_id=default_project.id,
        hash="aa1c4037371150958f9ea22adb110bbc",
        state=GroupHash.State.SPLIT,
        group_id=None,
    )

    events = [
        store_stacktrace(["baz", "bar2", "foo"]),
        store_stacktrace(["baz", "bar", "foo"]),
        store_stacktrace(["bam", "bar", "foo"]),
    ]

    assert len({e.group_id for e in events}) == 3

    assert (
        _render_all_previews(events[0].group)
        == """\
group: ZeroDivisionError
level 0
bab925683e73afdb4dc4047397a7b36b: ZeroDivisionError | foo (3)
level 1
c8ef2dd3dedeed29b4b74b9c579eea1a: ZeroDivisionError | foo | bar2 (1)
level 2*
7411b56aa6591edbdba71898d3a9f01c: ZeroDivisionError | foo | bar2 | baz (1)\
"""
    )
    assert (
        _render_all_previews(events[1].group)
        == """\
group: ZeroDivisionError
level 0
bab925683e73afdb4dc4047397a7b36b: ZeroDivisionError | foo (3)
level 1
aa1c4037371150958f9ea22adb110bbc: ZeroDivisionError | foo | bar (2)
level 2*
b8d08a573c62ca8c84de14c12c0e19fe: ZeroDivisionError | foo | bar | baz (1)\
"""
    )

    assert (
        _render_all_previews(events[2].group)
        == """\
group: ZeroDivisionError
level 0
bab925683e73afdb4dc4047397a7b36b: ZeroDivisionError | foo (3)
level 1
aa1c4037371150958f9ea22adb110bbc: ZeroDivisionError | foo | bar (2)
level 2*
97df6b60ec530c65ab227585143a087a: ZeroDivisionError | foo | bar | bam (1)\
"""
    )


@django_db_all
@pytest.mark.snuba
@region_silo_test(stable=True)
def test_default_events(default_project, store_stacktrace, reset_snuba, _render_all_previews):
    # Would like to add tree labels to default event titles as well,
    # But leave as is for now.
    event = store_stacktrace(["bar", "foo"], interface="threads", type="default")
    assert event.title == "<unlabeled event>"

    event = store_stacktrace(
        ["bar", "foo"], interface="threads", type="default", extra_event_data={"message": "hello"}
    )
    assert event.title == "hello"
