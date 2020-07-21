from __future__ import absolute_import

import pytest

import sentry.similarity
from sentry.grouping.strategies.configurations import CONFIGURATIONS

from tests.grouping import with_grouping_input


@pytest.fixture(
    params=[sentry.similarity.features, sentry.similarity.features2], ids=["features1", "features2"]
)
def similarity(request):
    return request.param


@pytest.mark.django_db
def test_basic(similarity, factories, set_feature, default_project):
    set_feature("projects:similarity-indexing")

    evt1 = factories.store_event(data={"message": "hello world"}, project_id=default_project.id)
    evt2 = factories.store_event(data={"message": "jello world"}, project_id=default_project.id)

    assert evt1.group_id != evt2.group_id

    similarity.record([evt1])
    similarity.record([evt2])

    if similarity is sentry.similarity.features:
        msg_label = "message:message:character-shingles"
    else:
        msg_label = "message:character-5-shingle"

    comparison = dict(similarity.compare(evt1.group))

    evt1_diff = comparison[evt1.group_id]
    assert set(evt1_diff.values()) == {None, 1.0}
    assert evt1_diff[msg_label] == 1.0

    evt2_diff = comparison[evt2.group_id]
    assert set(evt2_diff.values()) == {None, 0.5}
    assert evt2_diff[msg_label] == 0.5


@with_grouping_input("grouping_input")
def test_similarity_across_grouping_configs(grouping_input):
    evts = []
    for config_name in CONFIGURATIONS.keys():
        evt = grouping_input.create_event(config_name)
        similarity.features2.record(evt)
        evts.append(evt)
