from sentry.api.serializers import serialize
from sentry.models.grouphash import GroupHash
from sentry.models.grouptombstone import GroupTombstone
from sentry.testutils.cases import TestCase
from sentry.users.services.user.service import user_service


class GroupTombstoneSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user("foo@example.com")
        rpc_user = user_service.get_many(filter={"user_ids": [user.id]})[0]
        self.login_as(user=user)
        org = self.create_organization(owner=rpc_user)
        project = self.create_project(organization=org, name="CoolProj")
        group = self.create_group(project=project)
        tombstone = GroupTombstone.objects.create(
            project_id=group.project_id,
            level=group.level,
            message=group.message,
            culprit=group.culprit,
            data=group.data,
            actor_id=rpc_user.id,
            previous_group_id=group.id,
        )
        GroupHash.objects.create(
            project=group.project, hash="x" * 32, group=group, group_tombstone_id=tombstone.id
        )
        result = serialize(tombstone, rpc_user)

        assert result["message"] == group.message
        assert result["culprit"] == group.culprit
        assert result["actor"]["email"] == "foo@example.com"
