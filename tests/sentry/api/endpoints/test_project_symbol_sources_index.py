from typing import TYPE_CHECKING

import django.test
import pytest

from sentry.models import Project, User
from sentry.utils import json

if TYPE_CHECKING:
    from typing import Any, Callable, TypeVar

    F = TypeVar("F", bound=Callable[..., Any])

    # Declare django_db mark as a decorator which preserves the signature
    def _django_db(func: F) -> F:
        ...

    pytest.mark.django_db = _django_db

    # Declare fixture decorator to preserve the signature
    def _fixture(func: F) -> F:
        ...

    pytest.fixture = _fixture


class ApiClient(django.test.Client):  # type: ignore
    """Sentry-specific Django test client.

    This adds a few more convenience methods to call the sentry API and automatically logs
    in the user.  You should not create this directly but use the ``apiclient`` fixture
    instead.
    """

    def __init__(self, project: Project, user: User):
        super().__init__()
        self.login(username=user.username, password="admin")
        self.project_slug = project.slug
        self.organization_slug = project.organization.slug

    def project_get_response(self, path: str) -> django.test.Response:
        """Call a Project API endpoint.

        You probably should prefer :meth:`project_get` instead.

        The ``path`` is prefixed with ``/api/0/projects/{org_slug}/{proj_slug}/``.

        If you need the full control of the request use :meth:`get` directly.
        """
        path = f"/api/0/projects/{self.organization_slug}/{self.project_slug}/" + path
        return self.get(path)

    def project_get(self, path: str, *, status_code: int = 200) -> json.JSONData:
        """Call a Project API endpoint, expect response code and return JSON response body.

        The ``path`` is prefixed with ``/api/0/projects/{org_slug}/{proj_slug}/`` and the
        response code is asserted before the response JSON body is returned.

        If you need more control over the response use :meth:`project_get_response`, if you
        need full control of the request use :meth:`get` directly.
        """
        __tracebackhide__ = True
        response = self.project_get(path)
        if response.status_code != status_code:
            pytest.fail(
                f"API request to /api/0/projects/{{org_slug}}/{{proj_slug}}/{path}"
                f" bad status code: {response.status_code}"
            )
        return response.data


@pytest.fixture
def apiclient(default_project: Project, default_user: User) -> ApiClient:
    """An :class:`ApiClient instance to test the Sentry API endpoints.

    This client has the ``default_user`` fixture logged in and uses the ``default_project``
    for requests to the project endpoints.  It has some convenience methods to work with the
    project endpoints.
    """
    return ApiClient(default_project, default_user)


@pytest.fixture
def default_http_source(default_project: Project) -> json.JSONData:
    """Ensures there is an HTTP custom symbol source configured for ``default_project``.

    The config object itself is returned as the fixture value.
    """
    config = {
        "id": "9501a1ab-8d5b-4e3f-8d03-541077361576",
        "type": "http",
        "name": "My HTTP Source",
        "url": "http://example.com/symbol/source/",
        "username": "me",
        "password": "secret",
        "layout": {
            "type": "unified",
            "casing": "lowercase",
        },
        "filetypes": ["pe", "pdb"],
    }
    sources = json.loads(default_project.get_option("sentry:symbol_sources", default="[]"))
    sources.append(config)
    default_project.update_option("sentry:symbol_sources", json.dumps(sources))
    return config


@pytest.fixture
def default_s3_source(default_project: Project) -> json.JSONData:
    """Ensures there is an S3 custom symbol source configured for ``default_project``.

    The config object itself is returned as the fixture value.
    """
    config = {
        "id": "ea530b5d-9512-4295-9b3a-b0d3b0853bba",
        "type": "s3",
        "name": "My S3 Source",
        "bucket": "my-bucket",
        "region": "us-east-1",
        "access_key": "dummy-access-key",
        "secret_key": "dummy-secret-key",
        "prefix": "some/prefix/",
        "layout": {
            "type": "unified",
            "casing": "lowercase",
        },
        "filetypes": ["pe", "pdb"],
    }
    sources = json.loads(default_project.get_option("sentry:symbol_sources", default="[]"))
    sources.append(config)
    default_project.update_option("sentry:symbol_sources", json.dumps(sources))
    return config


@pytest.mark.django_db
def test_no_sources(apiclient: ApiClient) -> None:
    data = apiclient.project_get("symbolsources/", status_code=200)
    assert data == []


@pytest.mark.django_db
def test_some_sources(
    apiclient: ApiClient, default_http_source: json.JSONData, default_s3_source: json.JSONData
) -> json.JSONData:
    data = apiclient.project_get("symbolsources/", status_code=200)
    assert len(data) == 2


@pytest.mark.django_db
def test_http_secrets_redacted(apiclient: ApiClient, default_http_source: json.JSONData) -> None:
    data = apiclient.project_get("symbolsources/", status_code=200)
    config = data[0]
    assert config["password"] == {"hidden-secret": True}
