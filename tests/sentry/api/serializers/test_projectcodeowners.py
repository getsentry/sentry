from sentry.api.serializers.models.projectcodeowners import ProjectCodeOwnersSerializer
from sentry.testutils.cases import TestCase


class ProjectCodeOwnersSerializerTest(TestCase):
    def test_schema_response(self) -> None:
        code_mapping = self.create_code_mapping(project=self.project)
        codeowners = self.create_codeowners(
            project=self.project,
            code_mapping=code_mapping,
            schema={
                "$version": 1,
                "rules": [
                    {
                        "matcher": {"type": "codeowners", "pattern": "src/*"},
                        "owners": [
                            {"id": 1, "identifier": "user@example.com", "type": "user"},
                            {"identifier": "backend", "type": "team"},
                        ],
                    }
                ],
            },
        )
        serializer = ProjectCodeOwnersSerializer(expand=["hasTargetingContext"])
        response = serializer.serialize(
            codeowners,
            {"codeOwnersUrl": "unknown", "provider": "unknown"},
            self.user,
        )

        expected_schema = {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"type": "codeowners", "pattern": "src/*"},
                    "owners": [
                        {"id": "1", "name": "user@example.com", "type": "user"},
                        {"name": "backend", "type": "team"},
                    ],
                }
            ],
        }
        assert response["schema"] == expected_schema
