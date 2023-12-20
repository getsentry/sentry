from sentry.api.serializers import ApiTokenSerializer
from sentry.testutils.cases import TestCase


class TestApiTokenSerializer(TestCase):
    def setUp(self) -> None:
        self._user = self.create_user()
        self._scopes = ["test_scope"]
        self._token = self.create_user_auth_token(user=self._user, scope_list=self._scopes)
        self._serializer = ApiTokenSerializer()


class TestIncludeTokenFlag(TestApiTokenSerializer):
    def setUp(self) -> None:
        super().setUp()
        attrs = self._serializer.get_attrs(item_list=[self._token], user=self._user)
        attrs["application"] = None
        self._attrs = attrs

    def test_when_no_flag_is_passed(self) -> None:
        serialized_object = self._serializer.serialize(
            obj=self._token, user=self._user, attrs=self._attrs
        )
        assert "token" in serialized_object
        assert serialized_object["token"] == self._token.token

    def test_when_no_flag_is_true(self) -> None:
        serialized_object = self._serializer.serialize(
            obj=self._token, user=self._user, attrs=self._attrs
        )
        assert "token" in serialized_object
        assert serialized_object["token"] == self._token.token

    def test_when_flag_is_false(self) -> None:
        serialized_object = self._serializer.serialize(
            obj=self._token, user=self._user, attrs=self._attrs, include_token=False
        )
        assert "token" not in serialized_object


class TestLastTokenCharacters(TestApiTokenSerializer):
    def test_field_is_returned(self) -> None:
        attrs = self._serializer.get_attrs(item_list=[self._token], user=self._user)
        attrs["application"] = None
        serialized_object = self._serializer.serialize(
            obj=self._token, user=self._user, attrs=attrs
        )
        assert "tokenLastCharacters" in serialized_object
        assert serialized_object["tokenLastCharacters"] == self._token.token[-4:]
