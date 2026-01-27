import json
from datetime import datetime, timezone

from django.contrib.contenttypes.models import ContentType

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import no_silo_test
from sentry.users.services.user.serial import serialize_rpc_user
from social_auth.utils import ctype_to_model, model_to_ctype


@no_silo_test
class TestSocialAuthUtils(TestCase):
    def test_model_to_ctype(self) -> None:
        val = model_to_ctype(1)
        assert val == 1

        val = model_to_ctype(None)
        assert val is None

        user = self.create_user()
        val = model_to_ctype(user)
        assert val == {"pk": user.id, "ctype": ContentType.objects.get_for_model(user).pk}

        rpc_user = serialize_rpc_user(user)
        val = model_to_ctype(rpc_user)
        assert val == rpc_user.dict()

        # Test datetime serialization
        dt = datetime(2026, 1, 27, 15, 4, 33, 172220, tzinfo=timezone.utc)
        val = model_to_ctype(dt)
        assert val == {"__datetime__": "2026-01-27T15:04:33.172220+00:00"}

    def test_ctype_to_model(self) -> None:
        val = ctype_to_model(1)
        assert val == 1

        val = ctype_to_model(None)
        assert val is None

        user = self.create_user()
        ctype_val = {"pk": user.id, "ctype": ContentType.objects.get_for_model(user).pk}
        assert ctype_to_model(ctype_val) == user

        rpc_user = serialize_rpc_user(user)
        assert ctype_to_model(rpc_user.dict()) == rpc_user

        # Test datetime deserialization
        dt_val = {"__datetime__": "2026-01-27T15:04:33.172220+00:00"}
        dt = ctype_to_model(dt_val)
        assert dt == datetime(2026, 1, 27, 15, 4, 33, 172220, tzinfo=timezone.utc)

    def test_session_dict_json_serialization(self) -> None:
        """Test that session data with datetime objects can be JSON serialized."""
        # Simulate the session data that would be created in the OAuth pipeline
        user = self.create_user()
        dt = datetime(2026, 1, 27, 15, 4, 33, 172220, tzinfo=timezone.utc)

        # Create a session dict similar to what's created in to_session_dict
        session_data = {
            "next": 8,
            "backend": "asana",
            "kwargs": {
                "user": model_to_ctype(user),
                "expires_at": model_to_ctype(dt),
                "is_new": model_to_ctype(False),
                "uid": model_to_ctype("1212852066530292"),
            },
        }

        # This should not raise a TypeError
        json_str = json.dumps(session_data)
        assert json_str is not None

        # Verify we can deserialize it back
        deserialized = json.loads(json_str)
        assert deserialized["next"] == 8
        assert deserialized["backend"] == "asana"

        # Verify datetime was properly serialized
        assert deserialized["kwargs"]["expires_at"] == {
            "__datetime__": "2026-01-27T15:04:33.172220+00:00"
        }

        # Verify we can convert back to the original datetime
        restored_dt = ctype_to_model(deserialized["kwargs"]["expires_at"])
        assert restored_dt == dt
