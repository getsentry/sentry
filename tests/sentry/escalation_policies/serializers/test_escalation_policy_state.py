from sentry.api.serializers import serialize
from sentry.escalation_policies import trigger_escalation_policy
from sentry.escalation_policies.models.escalation_policy_state import EscalationPolicyStateType
from sentry.testutils.cases import TestCase


class BaseEscalationPolicySerializerTest:
    def assert_escalation_policy_state_serialized(self, state, result):
        assert result["id"] == state.id
        assert result["runStepN"] == 0
        assert result["runStepAt"] is not None
        assert result["state"] == EscalationPolicyStateType.UNACKNOWLEDGED
        assert result["escalationPolicy"] is not None
        assert result["group"] is not None


class EscalationPolicySerializerTest(BaseEscalationPolicySerializerTest, TestCase):
    def test_simple(self):
        project = self.create_project(name="foo")
        group = self.create_group(project=project)
        policy = self.create_escalation_policy()
        state = trigger_escalation_policy(policy, group)
        result = serialize(state)
        self.assert_escalation_policy_state_serialized(state, result)
