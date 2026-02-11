from unittest import TestCase

from sentry.apidocs.hooks import _ENDPOINT_SERVERS, custom_postprocessing_hook


class EndpointServersTest(TestCase):
    def setUp(self) -> None:
        _ENDPOINT_SERVERS.clear()

    def tearDown(self) -> None:
        _ENDPOINT_SERVERS.clear()

    def test_servers_applied_to_endpoint(self) -> None:
        """Test that servers from _ENDPOINT_SERVERS are applied to matching paths."""
        _ENDPOINT_SERVERS["/api/0/seer/models/"] = [{"url": "https://{region}.sentry.io"}]

        result = {
            "components": {"schemas": {}},
            "paths": {
                "/api/0/seer/models/": {
                    "get": {
                        "tags": ["Seer"],
                        "description": "Get models",
                        "operationId": "get models",
                        "parameters": [],
                    }
                },
                "/api/0/other/endpoint/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Other endpoint",
                        "operationId": "get other",
                        "parameters": [],
                    }
                },
            },
        }

        processed = custom_postprocessing_hook(result, None)

        # Servers should be applied to the matching endpoint
        assert processed["paths"]["/api/0/seer/models/"]["get"]["servers"] == [
            {"url": "https://{region}.sentry.io"}
        ]
        # Servers should NOT be applied to non-matching endpoint
        assert "servers" not in processed["paths"]["/api/0/other/endpoint/"]["get"]


class FixIssueRoutesTest(TestCase):
    def test_issue_route_fixes(self) -> None:
        BEFORE = {
            "components": {"schemas": {}},
            "paths": {
                "/api/0/organizations/{organization_id_or_slug}/{var}/{issue_id}/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Get issues",
                        "operationId": "get issue",
                        "parameters": [
                            {
                                "in": "path",
                                "name": "organization_id_or_slug",
                                "schema": {"type": "string"},
                                "description": "The ID or slug of the organization the resource belongs to.",
                                "required": True,
                            },
                            {
                                "in": "path",
                                "name": "var",
                                "schema": {"type": "string"},
                                "description": "Issues or groups",
                                "required": True,
                            },
                        ],
                    }
                },
                "/api/0/{var}/{issue_id}/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Get issues",
                        "operationId": "get issue",
                        "parameters": [
                            {
                                "in": "path",
                                "name": "var",
                                "schema": {"type": "string"},
                                "description": "Issues or groups",
                                "required": True,
                            },
                        ],
                    }
                },
                "/api/0/some/path/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Something else",
                        "operationId": "get something",
                        "parameters": [],
                    }
                },
            },
        }

        # Issue route with /organizations/{organization_id_or_slug}/ should be removed
        # Issue route with /{var}/{issue_id}/ should be renamed to /issues/{issue_id}/
        # "var" and "organization_id_or_slug" path parameters should be removed
        AFTER = {
            "paths": {
                "/api/0/some/path/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Something else",
                        "operationId": "get something",
                        "parameters": [],
                    }
                },
                "/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/": {
                    "get": {
                        "tags": ["Events"],
                        "description": "Get issues",
                        "operationId": "get issue",
                        "parameters": [],
                    }
                },
            },
            "components": {"schemas": {}},
        }
        assert custom_postprocessing_hook(BEFORE, None) == AFTER
