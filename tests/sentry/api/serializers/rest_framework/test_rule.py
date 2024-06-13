import uuid
from typing import Any

from sentry.api.serializers.rest_framework.rule import (
    ACTION_UUID_KEY,
    ensure_action_uuid,
    validate_actions,
)


class TestEnsureActionUuid:
    def test_overrides_bad_key(self) -> None:
        original_bad_key = "BAD_KEY-12312312"
        action = {
            "uuid": original_bad_key,
        }

        ensure_action_uuid(action)
        assert ACTION_UUID_KEY in action
        assert action[ACTION_UUID_KEY] != original_bad_key
        assert uuid.UUID(action[ACTION_UUID_KEY])

    def test_when_key_is_empty(self) -> None:
        action = {"uuid": ""}

        ensure_action_uuid(action)
        assert ACTION_UUID_KEY in action
        assert action[ACTION_UUID_KEY] != ""
        assert uuid.UUID(action[ACTION_UUID_KEY])

    def test_when_key_is_none(self) -> None:
        action = {"uuid": None}

        ensure_action_uuid(action)
        assert ACTION_UUID_KEY in action
        assert action[ACTION_UUID_KEY] is not None
        assert uuid.UUID(action[ACTION_UUID_KEY])

    def test_respects_good_key(self) -> None:
        original_good_key = str(uuid.uuid4())
        action = {
            "uuid": original_good_key,
        }

        ensure_action_uuid(action)
        assert ACTION_UUID_KEY in action
        assert action[ACTION_UUID_KEY] == original_good_key
        assert uuid.UUID(action[ACTION_UUID_KEY])

    def test_adds_uuid_key_when_not_found(self) -> None:
        action: dict[Any, Any] = {
            "some_other_key": "foo",
        }

        ensure_action_uuid(action)

        assert ACTION_UUID_KEY in action
        assert action[ACTION_UUID_KEY] is not None
        assert uuid.UUID(action[ACTION_UUID_KEY])

    def test_ignores_empty_dicts(self) -> None:
        action: dict[Any, Any] = {}
        ensure_action_uuid(action)
        assert ACTION_UUID_KEY not in action


class TestValidateActions:
    def test_updates_actions(self) -> None:
        bad_action = {
            "id": "whatever",
        }
        good_action_uuid = str(uuid.uuid4())
        good_action = {
            "id": "whatever",
            "uuid": good_action_uuid,
        }

        actions = [good_action, bad_action]
        attributes = {
            "actions": actions,
        }

        validated_data = validate_actions(attributes)
        validated_actions = validated_data["actions"]
        assert len(validated_actions) == len(actions)

        assert validated_actions[0][ACTION_UUID_KEY] == good_action_uuid

        assert ACTION_UUID_KEY in validated_actions[1]
        assert uuid.UUID(validated_actions[1][ACTION_UUID_KEY])
