from sentry.models.avatars.user_avatar import UserAvatar
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all(transaction=True)
def test_user_serialize_avatar_none():
    user = Factories.create_user()
    rpc_user = user_service.get_user(user_id=user.id)
    assert rpc_user
    assert rpc_user.avatar is None


@django_db_all(transaction=True)
def test_user_serialize_avatar():
    user = Factories.create_user()
    avatar = UserAvatar.objects.create(user_id=user.id, avatar_type=2, ident="abc123")

    rpc_user = user_service.get_user(user_id=user.id)
    assert rpc_user
    assert rpc_user.avatar
    assert rpc_user.avatar.id == avatar.id
    assert rpc_user.avatar.ident == avatar.ident
    assert rpc_user.avatar.avatar_type == "gravatar"


@django_db_all(transaction=True)
def test_user_serialize_multiple_emails():
    user = Factories.create_user()
    email = Factories.create_useremail(user=user, email="test@example.com", is_verified=True)
    unverified_email = Factories.create_useremail(
        user=user, email="nope@example.com", is_verified=False
    )

    rpc_user = user_service.get_user(user_id=user.id)
    assert rpc_user
    assert len(rpc_user.emails) == 2
    assert rpc_user.emails == {email.email, user.email}

    assert len(rpc_user.useremails) == 3
    expected = {user.email, email.email, unverified_email.email}
    assert expected == {e.email for e in rpc_user.useremails}
