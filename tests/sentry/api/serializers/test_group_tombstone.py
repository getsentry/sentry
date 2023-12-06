from sentry.api.serializers import serialize
from sentry.models.grouphash import GroupHash
from sentry.models.grouptombstone import GroupTombstone
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class GroupTombstoneSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user("foo@example.com")
        self.user = user_service.get_many(filter={"user_ids": [user.id]})[0]
        self.login_as(user=user)
        org = self.create_organization(owner=self.user)
        project = self.create_project(organization=org, name="CoolProj")
        group = self.create_group(project=project)
        tombstone = GroupTombstone.objects.create(
            project_id=group.project_id,
            level=group.level,
            message=group.message,
            culprit=group.culprit,
            data=group.data,
            actor_id=self.user.id,
            previous_group_id=group.id,
        )
        GroupHash.objects.create(
            project=group.project, hash="x" * 32, group=group, group_tombstone_id=tombstone.id
        )
        result = serialize(tombstone, self.user)

        assert result["message"] == group.message
        assert result["culprit"] == group.culprit
        assert result["actor"]["email"] == "foo@example.com"
