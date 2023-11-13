import unittest

from rest_framework import serializers
from rest_framework.exceptions import ErrorDetail
from rest_framework.serializers import ListField

from sentry.api.fields.actor import ActorField
from sentry.models.team import Team
from sentry.models.user import User
from sentry.testutils.cases import TestCase


class ChildSerializer(serializers.Serializer):
    b_field = serializers.CharField(max_length=64)
    d_field = serializers.CharField(max_length=64)


class DummySerializer(serializers.Serializer):
    a_field = ListField(child=ChildSerializer(), required=False, allow_null=False)
    actor_field = ActorField(required=False)


class TestListField(unittest.TestCase):
    def test_simple(self):
        data = {"a_field": [{"b_field": "abcdefg", "d_field": "gfedcba"}]}

        serializer = DummySerializer(data=data)
        assert serializer.is_valid()
        assert serializer.validated_data == {
            "a_field": [{"b_field": "abcdefg", "d_field": "gfedcba"}]
        }

    def test_allow_null(self):
        data = {"a_field": [None]}

        serializer = DummySerializer(data=data)
        assert not serializer.is_valid()
        assert serializer.errors == {
            "a_field": [ErrorDetail(string="This field may not be null.", code="null")]
        }

    def test_child_validates(self):
        data = {"a_field": [{"b_field": "abcdefg"}]}

        serializer = DummySerializer(data=data)
        assert not serializer.is_valid()
        assert serializer.errors == {
            "a_field": {"d_field": [ErrorDetail(string="This field is required.", code="required")]}
        }


class TestActorField(TestCase):
    def test_simple(self):
        data = {"actor_field": f"user:{self.user.id}"}

        serializer = DummySerializer(data=data, context={"organization": self.organization})
        assert serializer.is_valid()

        assert serializer.validated_data["actor_field"].type == User
        assert serializer.validated_data["actor_field"].id == self.user.id

    def test_legacy_user_fallback(self):
        data = {"actor_field": f"{self.user.id}"}

        serializer = DummySerializer(data=data, context={"organization": self.organization})
        assert serializer.is_valid()

        assert serializer.validated_data["actor_field"].type == User
        assert serializer.validated_data["actor_field"].id == self.user.id

    def test_team(self):
        data = {"actor_field": f"team:{self.team.id}"}

        serializer = DummySerializer(data=data, context={"organization": self.organization})
        assert serializer.is_valid()
        assert serializer.validated_data["actor_field"].type == Team
        assert serializer.validated_data["actor_field"].id == self.team.id

    def test_permissions(self):
        other_org = self.create_organization()
        serializer = DummySerializer(
            data={"actor_field": f"user:{self.user.id}"}, context={"organization": other_org}
        )
        assert not serializer.is_valid()
        assert serializer.errors["actor_field"] == [
            ErrorDetail("User is not a member of this organization", "invalid")
        ]

        serializer = DummySerializer(
            data={"actor_field": f"team:{self.team.id}"}, context={"organization": other_org}
        )
        assert not serializer.is_valid()
        assert serializer.errors["actor_field"] == [
            ErrorDetail("Team is not a member of this organization", "invalid")
        ]

    def test_validates(self):
        data = {"actor_field": "foo:1"}

        serializer = DummySerializer(data=data, context={"organization": self.organization})
        assert not serializer.is_valid()
        assert serializer.errors == {
            "actor_field": [
                "Could not parse actor. Format should be `type:id` where type is `team` or `user`."
            ]
        }
