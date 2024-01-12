import pytest
from django.test import RequestFactory, override_settings

from sentry.integrations.utils.atlassian_connect import (
    AtlassianConnectValidationError,
    get_integration_from_jwt,
    get_query_hash,
    get_token,
    parse_integration_from_request,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class AtlassianConnectTest(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.provider = "jira"
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="testserver.jira:123",
            metadata={"shared_secret": "shared-super-secret"},
            provider=self.provider,
        )
        self.path = f"/extensions/{self.provider}/configure/"
        self.method = "GET"
        self.query_params = {"a": "1", "b": "2", "c": "3", "test": "pass"}
        self.query_string = "a=1&b=2&c=3&test=pass"
        self.query_hash = "36f43b88d6a8cdf89bb8f744e2378bb0ceb6378e80ab0b513082a8b72396bccc"
        self.valid_jwt = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJ0ZXN0c2VydmVyLmppcmE6MTIzIiwiaWF0IjoxMjM0NTY3ODkwLCJleHAiOjk5OTk5OTk5OTksInFzaCI6IjM2ZjQzYjg4ZDZhOGNkZjg5YmI4Zjc0NGUyMzc4YmIwY2ViNjM3OGU4MGFiMGI1MTMwODJhOGI3MjM5NmJjY2MiLCJzdWIiOiJjb25uZWN0OjEyMyJ9.DjaYGvzLDO0RWTbNRHk3jyXsUvo9Jb7fAP8hguqpMvE"
        self.unknown_issuer_jwt = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJ0ZXN0c2VydmVyLmppcmE6dW5rbm93biIsImlhdCI6MTIzNDU2Nzg5MCwiZXhwIjo5OTk5OTk5OTk5LCJxc2giOiIzNmY0M2I4OGQ2YThjZGY4OWJiOGY3NDRlMjM3OGJiMGNlYjYzNzhlODBhYjBiNTEzMDgyYThiNzIzOTZiY2NjIiwic3ViIjoiY29ubmVjdDoxMjMifQ.dhIYA45uNkp4jONnpniNeW-k7E3dywJhPzMI55KVlus"
        self.invalid_secret_jwt = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJ0ZXN0c2VydmVyLmppcmE6MTIzIiwiaWF0IjoxMjM0NTY3ODkwLCJleHAiOjk5OTk5OTk5OTksInFzaCI6IjM2ZjQzYjg4ZDZhOGNkZjg5YmI4Zjc0NGUyMzc4YmIwY2ViNjM3OGU4MGFiMGI1MTMwODJhOGI3MjM5NmJjY2MiLCJzdWIiOiJjb25uZWN0OjEyMyJ9.7nGQQWUeXewnfL8_yvwzLGyf_rgkGdaQxKbDoi7tu_g"

        self.expired_jwt = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJ0ZXN0c2VydmVyLmppcmE6MTIzIiwiaWF0IjoxMjM0NTY3ODkwLCJleHAiOjEyMzQ1Njc4OTAsInFzaCI6IjM2ZjQzYjg4ZDZhOGNkZjg5YmI4Zjc0NGUyMzc4YmIwY2ViNjM3OGU4MGFiMGI1MTMwODJhOGI3MjM5NmJjY2MiLCJzdWIiOiJjb25uZWN0OjEyMyJ9.1ZIrXDbaS6nUMgtmdCE1BFbsT7yvNKTkzVnSjX-Q7TA"

    def test_get_token_success(self):
        request = self.factory.post(path=self.path, HTTP_AUTHORIZATION=f"JWT {self.valid_jwt}")
        assert get_token(request) == self.valid_jwt

        request = self.factory.post(path=self.path, HTTP_AUTHORIZATION=f"Bearer {self.valid_jwt}")
        assert get_token(request) == self.valid_jwt

    def test_get_token_error(self):
        request = self.factory.post(path=self.path, AUTHORIZATION=f"JWT {self.valid_jwt}")
        with pytest.raises(AtlassianConnectValidationError):
            get_token(request)

        request = self.factory.post(path=self.path, HTTP_AUTHORIZATION=f"JWT{self.valid_jwt}")
        with pytest.raises(AtlassianConnectValidationError):
            get_token(request)

    def test_get_query_hash(self):
        result = get_query_hash(uri=self.path, method=self.method, query_params=self.query_params)
        assert result == self.query_hash

    def test_get_integration_from_jwt_success(self):
        integration = get_integration_from_jwt(
            token=self.valid_jwt,
            path=self.path,
            provider=self.provider,
            query_params=self.query_params,
            method=self.method,
        )
        assert integration.id == self.integration.id

    def test_get_integration_from_jwt_failure(self):
        try:
            get_integration_from_jwt(
                token=None, path=self.path, provider=self.provider, query_params=None
            )
        except AtlassianConnectValidationError as e:
            assert str(e) == "No token parameter"

        try:
            get_integration_from_jwt(
                token=self.unknown_issuer_jwt,
                path=self.path,
                provider=self.provider,
                query_params=self.query_params,
                method=self.method,
            )
        except AtlassianConnectValidationError as e:
            assert str(e) == "No integration found"

        try:
            get_integration_from_jwt(
                token=self.invalid_secret_jwt,
                path=self.path,
                provider=self.provider,
                query_params=self.query_params,
                method=self.method,
            )
        except AtlassianConnectValidationError as e:
            assert str(e) == "Signature is invalid"

        try:
            get_integration_from_jwt(
                token=self.valid_jwt,
                path=self.path,
                provider=self.provider,
                query_params={"wrong": "query_params"},
                method=self.method,
            )
        except AtlassianConnectValidationError as e:
            assert str(e) == "Query hash mismatch"

        try:
            get_integration_from_jwt(
                token=self.expired_jwt,
                path=self.path,
                provider=self.provider,
                query_params=self.query_params,
                method=self.method,
            )
        except AtlassianConnectValidationError as e:
            assert str(e) == "Signature is expired"

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    def test_parse_integration_from_request(self):
        """This is the only function unique to the Control Silo"""
        # From request header...
        request = self.factory.get(
            path=self.path,
            HTTP_AUTHORIZATION=f"JWT {self.valid_jwt}",
            QUERY_STRING=self.query_string,
        )
        integration = parse_integration_from_request(request=request, provider=self.provider)
        assert integration == self.integration

        # From query string...
        request = self.factory.get(
            path=self.path,
            QUERY_STRING=self.query_string + f"&jwt={self.valid_jwt}",
        )
        integration = parse_integration_from_request(request=request, provider=self.provider)
        assert integration == self.integration
