import time

from sentry.services.hybrid_cloud.user_option import get_option_from_list, user_option_service
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import all_silo_test


@django_db_all(transaction=True)
@all_silo_test
def test_user_option_service():
    objects = [1, dict(a=dict(b=3)), "asdf", 9873, [1, 2, 3], 511]

    u1 = Factories.create_user()
    u2 = Factories.create_user()

    # snowflake id generation issues...
    time.sleep(1)
    o1 = Factories.create_organization()
    time.sleep(1)
    p1 = Factories.create_project(organization=o1)

    assert (
        get_option_from_list(
            user_option_service.get_many(filter={"user_ids": [u1.id]}), key="a_key"
        )
        is None
    )
    assert (
        get_option_from_list(
            user_option_service.get_many(filter={"user_ids": [u1.id]}),
            key="a_key",
            default=objects[0],
        )
        == objects[0]
    )

    user_option_service.set_option(user_id=u1.id, value=objects[1], key="a_key")
    assert (
        get_option_from_list(
            user_option_service.get_many(filter={"user_ids": [u1.id]}), key="a_key"
        )
        == objects[1]
    )
    assert (
        get_option_from_list(
            user_option_service.get_many(filter={"user_ids": [u1.id], "project_id": p1.id}),
            key="a_key",
        )
        is None
    )

    user_option_service.set_option(user_id=u1.id, value=objects[2], key="a_key", project_id=p1.id)
    assert (
        get_option_from_list(
            user_option_service.get_many(filter={"user_ids": [u1.id]}), key="a_key"
        )
        == objects[1]
    )
    assert (
        get_option_from_list(
            user_option_service.get_many(filter={"user_ids": [u1.id], "project_id": p1.id}),
            key="a_key",
        )
        == objects[2]
    )
    assert (
        get_option_from_list(
            user_option_service.get_many(filter={"user_ids": [u1.id], "organization_id": o1.id}),
            key="a_key",
        )
        is None
    )

    user_option_service.set_option(
        user_id=u1.id, value=objects[3], key="a_key", organization_id=o1.id
    )
    assert (
        get_option_from_list(
            user_option_service.get_many(filter={"user_ids": [u1.id]}), key="a_key"
        )
        == objects[1]
    )
    assert (
        get_option_from_list(
            user_option_service.get_many(filter={"user_ids": [u1.id], "project_id": p1.id}),
            key="a_key",
        )
        == objects[2]
    )

    assert (
        get_option_from_list(
            user_option_service.get_many(filter={"user_ids": [u1.id], "organization_id": o1.id}),
            key="a_key",
        )
        == objects[3]
    )

    assert (
        get_option_from_list(
            user_option_service.get_many(
                filter={"user_ids": [u1.id], "keys": ["a_key"], "project_id": p1.id}
            ),
            key="a_key",
        )
        == objects[2]
    )
    assert (
        get_option_from_list(
            user_option_service.get_many(
                filter={"user_ids": [u1.id], "keys": ["a_key"], "project_id": p1.id}
            ),
            key="b_key",
        )
        is None
    )

    user_option_service.set_option(
        user_id=u2.id, value=objects[4], key="a_key", organization_id=o1.id
    )
    user_option_service.set_option(user_id=u2.id, value=objects[5], key="a_key")

    assert (
        get_option_from_list(
            user_option_service.get_many(filter={"user_ids": [u1.id, u2.id], "keys": ["a_key"]}),
            key="a_key",
            user_id=u2.id,
        )
        == objects[5]
    )
    assert (
        get_option_from_list(
            user_option_service.get_many(filter={"user_ids": [u1.id, u2.id], "keys": ["a_key"]}),
            key="a_key",
            user_id=u1.id,
        )
        == objects[1]
    )

    user_option_service.delete_options(
        option_ids=[o.id for o in user_option_service.get_many(filter={"user_ids": [u1.id]})]
    )

    assert (
        get_option_from_list(
            user_option_service.get_many(filter={"user_ids": [u1.id]}), key="a_key"
        )
        is None
    )
    assert (
        get_option_from_list(
            user_option_service.get_many(filter={"user_ids": [u1.id], "project_id": p1.id}),
            key="a_key",
        )
        is not None
    )
