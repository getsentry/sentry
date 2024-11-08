from drf_spectacular.utils import OpenApiExample


class EnvironmentExamples:
    GET_ORGANIZATION_ENVIRONMENTS = [
        OpenApiExample(
            "List an Organization's Environments",
            value=[
                {
                    "id": "1",
                    "name": "Production",
                },
                {
                    "id": "2",
                    "name": "Staging",
                },
            ],
            status_codes=["200"],
            response_only=True,
        )
    ]

    GET_PROJECT_ENVIRONMENTS = [
        OpenApiExample(
            "List a Project's Environments",
            value=[
                {"id": "1", "name": "Production", "isHidden": False},
                {"id": "2", "name": "Staging", "isHidden": True},
            ],
            status_codes=["200"],
            response_only=True,
        )
    ]
