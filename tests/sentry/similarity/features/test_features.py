from __future__ import absolute_import

import pytest

import sentry.similarity


@pytest.fixture(
    params=[sentry.similarity.features, sentry.similarity.features2], ids=["features1", "features2"]
)
def similarity(request):
    return request.param


@pytest.mark.django_db
def test_basic(similarity, factories, set_feature, default_project):
    set_feature("projects:similarity-indexing")

    e1 = factories.store_event(data={"message": "hello world"}, project_id=default_project.id)
    e2 = factories.store_event(data={"message": "jello world"}, project_id=default_project.id)

    assert e1.group_id != e2.group_id

    similarity.record([e1])
    similarity.record([e2])

    if similarity is sentry.similarity.features:
        msg_label = "message:message:character-shingles"
    else:
        msg_label = "message"

    comparison = dict(similarity.compare(e1.group))

    e1_diff = comparison[e1.group_id]
    assert set(e1_diff.values()) == {None, 1.0}
    assert e1_diff[msg_label] == 1.0

    e2_diff = comparison[e2.group_id]
    assert set(e2_diff.values()) == {None, 0.5}
    assert e2_diff[msg_label] == 0.5
