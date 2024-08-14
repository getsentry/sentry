from sentry.api.serializers import serialize
from sentry.testutils.cases import TestCase


class BaseEscalationPolicySerializerTest:
    def assert_escalation_policy_serialized(self, policy, result):
        assert result["id"] == str(policy.id)
        assert result["name"] == str(policy.name)
        assert result["description"] == policy.description
        assert len(result["steps"]) == 2
        assert result["team"] is None
        assert result["user"] is None

        assert result["steps"][0]["escalate_after_sec"] == 30
        assert result["steps"][0]["recipients"][0]["type"] == "team"
        assert result["steps"][0]["recipients"][1]["type"] == "user"
        assert result["steps"][1]["escalate_after_sec"] == 30
        assert result["steps"][1]["recipients"][0]["type"] == "team"
        assert result["steps"][1]["recipients"][1]["type"] == "user"


class EscalationPolicySerializerTest(BaseEscalationPolicySerializerTest, TestCase):
    def test_simple(self):
        policy = self.create_escalation_policy()
        result = serialize(policy)
        self.assert_escalation_policy_serialized(policy, result)
