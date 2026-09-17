from __future__ import annotations

from sentry.api.serializers import serialize
from sentry.investigations.endpoints.serializers import InvestigationParameterSerializer
from sentry.testutils.cases import TestCase


class InvestigationParameterSerializerTest(TestCase):
    def test_serializes_a_parameter(self) -> None:
        investigation = self.create_investigation(
            organization=self.organization, title="Investigation"
        )
        parameter = self.create_investigation_parameter(
            investigation=investigation,
            key="environment",
            label="Environment",
            description="Which environment to inspect",
            type="string",
            position=0,
            required=True,
            validation_constraints={"maxLength": 64},
            default_value="prod",
        )

        result = serialize(parameter, self.user, InvestigationParameterSerializer())

        assert result == {
            "id": str(parameter.id),
            "key": "environment",
            "label": "Environment",
            "description": "Which environment to inspect",
            "type": "string",
            "required": True,
            "constraints": {"maxLength": 64},
            "defaultValue": "prod",
            "savedValue": None,
            "source": parameter.source,
            "position": 0,
            "version": 1,
        }
