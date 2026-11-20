import pytest

from sentry.objectstore import UsecaseId, get_session
from sentry.testutils.cases import TestCase


class GetSessionTest(TestCase):
    def test_project_scope(self) -> None:
        project = self.project
        org = project.organization_id
        path = f"/v1/objects/attachments/org={org};project={project.id}/key"
        assert get_session(UsecaseId.ATTACHMENTS, project).object_url("key").endswith(path)
        assert get_session(UsecaseId.ATTACHMENTS, project, org=org).object_url("key").endswith(path)
        assert (
            get_session(UsecaseId.ATTACHMENTS, project.id, org=org).object_url("key").endswith(path)
        )

    def test_organization_scope(self) -> None:
        session = get_session(UsecaseId.ARTIFACT_BUNDLES, project=None, org=1)
        assert session.object_url("key").endswith("/v1/objects/artifact_bundles/org=1/key")

    def test_organization_scope_requires_explicit_project(self) -> None:
        with pytest.raises(TypeError, match="missing .* 'project'"):
            get_session(UsecaseId.ARTIFACT_BUNDLES, org=1)  # type: ignore[call-arg]

    def test_organization_scope_requires_org(self) -> None:
        with pytest.raises(TypeError, match="org is required for an organization-only session"):
            get_session(UsecaseId.ARTIFACT_BUNDLES, project=None)

    def test_project_id_requires_org(self) -> None:
        with pytest.raises(TypeError, match="org is required when project is an ID"):
            get_session(UsecaseId.ATTACHMENTS, 2)

    def test_project_must_belong_to_org(self) -> None:
        with pytest.raises(ValueError, match="project does not belong to org"):
            get_session(UsecaseId.ATTACHMENTS, self.project, org=self.project.organization_id + 1)
