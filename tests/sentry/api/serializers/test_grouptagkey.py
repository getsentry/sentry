from sentry.api.serializers import serialize
from sentry.tagstore.types import GroupTagKey
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class GroupTagKeySerializerTest(TestCase):
    def test(self):
        user = self.create_user()
        grouptagkey = GroupTagKey(group_id=0, key="key", values_seen=1)

        result = serialize(grouptagkey, user)
        assert result["key"] == "key"
        assert result["uniqueValues"] == 1
