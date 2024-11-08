from drf_spectacular.utils import OpenApiExample


class EnvironmentExamples:
    EXAMPLE_ORG_ENVIRONMENTS = [
        {"id": "1", "name": "Production"},
        {"id": "2", "name": "Staging"},
    ]
    GET_ORGANIZATION_ENVIRONMENTS = [
        OpenApiExample(
            "List an Organization's Environments",
            value=EXAMPLE_ORG_ENVIRONMENTS,
            status_codes=["200"],
            response_only=True,
        )
    ]

    EXAMPLE_PROJECT_ENVIRONMENTS = [
        {"id": "1", "name": "Production", "isHidden": False},
        {"id": "2", "name": "Staging", "isHidden": True},
    ]

    GET_PROJECT_ENVIRONMENTS = [
        OpenApiExample(
            "List a Project's Environments",
            value=EXAMPLE_PROJECT_ENVIRONMENTS,
            status_codes=["200"],
            response_only=True,
        )
    ]

    RETRIEVE_PROJECT_ENVIRONMENT = [
        OpenApiExample(
            "Retrieve a Project Environment",
            value=EXAMPLE_PROJECT_ENVIRONMENTS[0],
            status_codes=["200"],
            response_only=True,
        )
    ]
