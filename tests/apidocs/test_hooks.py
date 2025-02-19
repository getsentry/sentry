from sentry.apidocs.hooks import custom_postprocessing_hook
from sentry.testutils.cases import TestCase


class FixIssueRoutesTest(TestCase):
    def test_issue_route_fixes(self):
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
