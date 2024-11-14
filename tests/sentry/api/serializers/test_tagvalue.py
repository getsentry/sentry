from datetime import datetime
from unittest.mock import patch

from sentry.api.serializers import UserTagValueSerializer, serialize
from sentry.tagstore.types import TagValue
from sentry.testutils.cases import TestCase
from sentry.utils.eventuser import EventUser


class TagValueSerializerTest(TestCase):
    def test_with_user(self):
        user = self.create_user()
        tagvalue = TagValue(
            key="sentry:user",
            value="username:ted",
            times_seen=1,
            first_seen=datetime(2018, 1, 1),
            last_seen=datetime(2018, 1, 1),
        )

        result = serialize(tagvalue, user)
        assert result["key"] == "user"
        assert result["value"] == "username:ted"
        assert result["name"] == "ted"
        assert result["query"] == 'user.username:"ted"'

    def test_release(self):
        user = self.create_user()
        tagvalue = TagValue(
            key="sentry:release",
            value="df84bccbb23ca15f2868be1f2a5f7c7a6464fadd",
            times_seen=1,
            first_seen=datetime(2018, 1, 1),
            last_seen=datetime(2018, 1, 1),
        )

        result = serialize(tagvalue, user)
        assert result["key"] == "release"
        assert result["value"] == "df84bccbb23ca15f2868be1f2a5f7c7a6464fadd"
        assert result["name"] == "df84bccbb23ca15f2868be1f2a5f7c7a6464fadd"
        assert "query" not in result


class UseTagValueSerializerTest(TestCase):
    def test_query(self):
        user = self.create_user()
        tagvalue = TagValue(
            key="sentry:user",
            value="username:ted",
            times_seen=1,
            first_seen=datetime(2018, 1, 1),
            last_seen=datetime(2018, 1, 1),
        )

        result = serialize(
            tagvalue, user, serializer=UserTagValueSerializer(project_id=self.project.id)
        )
        assert result["value"] == "username:ted"
        assert result["query"] == 'user.username:"ted"'

    @patch("sentry.utils.eventuser.EventUser.for_tags")
    def test_with_event_user(self, mock_for_tags):
        user = self.create_user()
        mock_for_tags.return_value = {
            f"id:{user.id}": EventUser(
                project_id=self.project.id,
                email=self.user.email,
                username="username",
                name="name",
                ip_address=None,
                user_ident=user.id,
                id=None,
            )
        }

        tagvalue = TagValue(
            key="sentry:user",
            value=f"id:{user.id}",
            times_seen=1,
            first_seen=datetime(2018, 1, 1),
            last_seen=datetime(2018, 1, 1),
        )

        result = serialize(
            tagvalue, user, serializer=UserTagValueSerializer(project_id=self.project.id)
        )

        assert result["value"] == f"id:{user.id}"
        assert result["id"] == str(user.id)
