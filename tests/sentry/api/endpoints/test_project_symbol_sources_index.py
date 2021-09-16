import django.test
import pytest

from sentry.utils import json


class ApiClient(django.test.Client):
    """Sentry-specific Django test client.

    This adds a few more convenience methods to call the sentry API and automatically logs
    in the user.  You should not create this directly but use the ``apiclient`` fixture
    instead.
    """

    def __init__(self, project, user):
        super().__init__()
        self.login(username=user.username, password="admin")
        self.project_slug = project.slug
        self.organization_slug = project.organization.slug

    def project_get(self, path, data=None, follow=False, secure=False, **extra):
        """Call a Project API endpoint.

        The ``path`` is automatically prefixed with
        ``/api/0/projects/{org_slug}/{proj_slug}/``.  The ``format='json'`` argument is
        added automatically so that all requests are JSON requests by default.
        """
        path = f"/api/0/projects/{self.organization_slug}/{self.project_slug}/" + path
        return self.get(path, data, follow, secure, **extra)

    def project_get_2xx(self, path, data=None, follow=None, secure=False, **extra):
        """Call a Project API endpoint, expect a 2XX response.

        Similar to :meth:`project_get` but also asserts the response status code was in the 200
        range and returns only the JSON response body.
        """
        __tracebackhide__ = True
        response = self.project_get(path, data, follow, secure, **extra)
        if not 200 <= response.status_code < 300:
            pytest.fail(
                f"API request to /api/0/projects/{{org_slug}}/{{proj_slug}}/{path}"
                f" bad status code: {response.status_code}"
            )
        return response.data


@pytest.fixture
def apiclient(default_project, default_user):
    """An :class:`ApiClient instance to test the Sentry API endpoints.

    This client has the ``default_user`` fixture logged in and uses the ``default_project``
    for requests to the project endpoints.  It has some convenience methods to work with the
    project endpoints.
    """
    return ApiClient(default_project, default_user)


@pytest.fixture
def default_http_source(default_project):
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
def default_s3_source(default_project):
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
def test_no_sources(apiclient):
    data = apiclient.project_get_2xx("symbolsources/")
    assert data == []


@pytest.mark.django_db
def test_some_sources(apiclient, default_http_source, default_s3_source):
    data = apiclient.project_get_2xx("symbolsources/")
    assert len(data) == 2


@pytest.mark.django_db
def test_http_secrets_redacted(apiclient, default_http_source):
    data = apiclient.project_get_2xx("symbolsources/")
    config = data[0]
    assert config["password"] == {"hidden-secret": True}
