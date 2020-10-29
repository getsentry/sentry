from __future__ import absolute_import

import pytest

from sentry.models import Group, Project
from sentry.event_manager import EventManager
from sentry.grouping.api import get_default_grouping_config_dict
from sentry.grouping.strategies.configurations import CONFIGURATIONS
from sentry.utils.compat import zip
from sentry.utils import json
from sentry import eventstore

import sentry.similarity

from tests.sentry.grouping import with_grouping_input, with_fingerprint_input


def create_event(data, group_id=123):
    mgr = EventManager(data=data, grouping_config=get_default_grouping_config_dict())
    mgr.normalize()
    data = mgr.get_data()

    evt = eventstore.create_event(data=data)
    evt.project = project = Project(id=123)
    evt.group = Group(id=group_id, project=project)

    return evt


@pytest.fixture(
    params=[sentry.similarity.features, sentry.similarity.features2], ids=["features1", "features2"]
)
def similarity(request):
    return request.param


def test_basic(similarity):
    evt1 = create_event({"message": "hello world"}, group_id=123)
    evt2 = create_event({"message": "jello world"}, group_id=345)

    similarity.record([evt1])
    similarity.record([evt2])

    if similarity is sentry.similarity.features:
        msg_label = "message:message:character-shingles"
    else:
        msg_label = ("similarity:2020-07-23", "message", "character-5-shingle")

    comparison = dict(similarity.compare(evt1.group))

    evt1_diff = comparison[evt1.group_id]
    assert set(evt1_diff.values()) == {None, 1.0}
    assert evt1_diff[msg_label] == 1.0

    evt2_diff = comparison[evt2.group_id]
    assert set(evt2_diff.values()) == {None, 0.5}
    assert evt2_diff[msg_label] == 0.5


@with_grouping_input("grouping_input")
def test_similarity_extract_grouping_input(grouping_input, insta_snapshot):
    similarity = sentry.similarity.features2

    evt = grouping_input.create_event(get_default_grouping_config_dict())
    evt.project = project = Project(id=123)
    evt.group = Group(id=123, project=project)

    snapshot = []
    for label, features in similarity.extract(evt).items():
        for feature in features:
            snapshot.append("{}: {}".format(":".join(label), json.dumps(feature, sort_keys=True)))

    insta_snapshot("\n".join(sorted(snapshot)))


@with_fingerprint_input("fingerprint_input")
def test_similarity_extract_fingerprinting(fingerprint_input, insta_snapshot):
    similarity = sentry.similarity.features2

    _, evt = fingerprint_input.create_event(get_default_grouping_config_dict())
    evt.project = project = Project(id=123)
    evt.group = Group(id=123, project=project)

    snapshot = []
    for label, features in similarity.extract(evt).items():
        for feature in features:
            snapshot.append("{}: {}".format(":".join(label), json.dumps(feature, sort_keys=True)))

    insta_snapshot("\n".join(sorted(snapshot)))


def _get_configurations():
    # Sort configurations by ascending date
    strategies = sorted(CONFIGURATIONS.keys(), key=lambda x: x.split(":")[-1])
    return list(zip(strategies, strategies[1:]))


@pytest.mark.parametrize("config,next_config", _get_configurations())
def test_config_migration(config, next_config):
    """
    This test simulates migrating a similarity cluster to a new grouping
    strategy. We reinstantiate the FeatureSet using get_feature_set while in
    practice one would set the corresponding Django setting to a different
    value and redeploy.
    """

    def get_feature_set(configs):
        index = sentry.similarity.features2.index
        return sentry.similarity.GroupingBasedFeatureSet(
            index=index, configurations={c: c for c in configs}
        )

    events = []

    def send_event(similarity, group_id=None):
        if group_id is None:
            group_id = 123 + len(events)

        evt = create_event(data={"message": "hello world"}, group_id=group_id)

        similarity.record([evt])
        events.append(evt)
        return evt.group

    def compare(similarity, group):
        return set(dict(similarity.compare(group)))

    # Step 1: Legacy config is used to index first event
    similarity = get_feature_set([config])
    g1 = send_event(similarity)

    # Step 2: Similarity system is migrated to newstyle while still keeping
    # legacy config around to find old features.
    # g1, though indexed with legacy, still shows up in similarity (though with
    # broken score)
    similarity = get_feature_set([config, next_config])
    g2 = send_event(similarity)
    assert compare(similarity, g1) == {g1.id, g2.id}

    # Step 3: New config is used exclusively
    # g1 is "missing" as it uses features from legacy we no longer search for
    # Attempt at migration failed!
    similarity = get_feature_set([next_config])
    g3 = send_event(similarity)
    assert compare(similarity, g2) == {g2.id, g3.id}
    assert compare(similarity, g3) == {g2.id, g3.id}
    assert not compare(similarity, g1)

    # Step 4: System is reverted to multi-config setup (because g1 is "broken")
    # g1 is only comparable to g2, as g3 does not have legacy features
    # g2 is comparable with every group as it has features from both configs
    # g3 is comparable to g2, as g1 does not have newstyle features
    similarity = get_feature_set([config, next_config])
    assert compare(similarity, g1) == {g1.id, g2.id}
    assert compare(similarity, g2) == {g1.id, g2.id, g3.id}
    assert compare(similarity, g3) == {g2.id, g3.id}

    # Step 5: New event goes into g1
    # g1 now has newstyle features and is comparable to all groups
    send_event(similarity, g1.id)
    assert (
        compare(similarity, g1)
        == compare(similarity, g2)
        == compare(similarity, g3)
        == {g1.id, g2.id, g3.id}
    )

    # Step 6: Second attempt at using new config exclusively
    # Since all groups now have newstyle features, they are all comparable
    # Migration successful!
    # NOTE: At this point you will have dangling keys for the legacy features
    # in your Redis that need manual cleanup.
    similarity = get_feature_set([next_config])
    assert (
        compare(similarity, g1)
        == compare(similarity, g2)
        == compare(similarity, g3)
        == {g1.id, g2.id, g3.id}
    )

    assert g1.id != g2.id != g3.id
