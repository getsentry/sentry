from typing import Any

from rest_framework.response import Response

from perf_harness.workload import EndpointContext, Workload


def build_workload(case: EndpointContext, parameters: dict[str, Any]) -> Workload:
    if parameters:
        raise ValueError("project-details accepts no parameters")
    project = case.create_project(teams=[case.team])
    case.login_as(user=case.user)
    case.endpoint = "sentry-api-0-project-details"

    def validate(response: Response) -> None:
        assert response.status_code == 200
        assert response.data["id"] == str(project.id)

    return Workload(
        operation=lambda: case.get_success_response(case.organization.slug, project.slug),
        validate=validate,
    )
