# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.api.serializers import serialize
from sentry.api.serializers.models.sentry_app import SentryAppSerializer
from sentry.testutils import TestCase

# from sentry.constants import SentryAppStatus


class SentryAppSerializerTest(TestCase):
    def test_published_app(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        sentry_app = self.create_sentry_app(
            name="Tesla App",
            organization=organization,
            published=True,
            scopes=("org:write", "team:admin"),
        )
        result = serialize(sentry_app, None, SentryAppSerializer(), access=None)

        assert result["name"] == "Tesla App"
        assert result["featureData"] == [
            {
                "description": "Tesla App can **utilize the Sentry API** to pull data or update resources in Sentry (with permissions granted, of course).",
                "featureGate": "integrations-api",
            }
        ]
        assert result["scopes"] == ["org:write", "team:admin"]
        assert result.get("clientSecret") is None

    def test_internal_app(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.create_project(organization=org)
        sentry_app = self.create_internal_integration(
            name="La Croix App", organization=org, scopes=("org:write", "team:admin")
        )
        result = serialize(sentry_app, None, SentryAppSerializer(), access=None)

        assert result["name"] == "La Croix App"
        assert result["status"] == "internal"
        assert result["featureData"] == []
        assert result["scopes"] == ["org:write", "team:admin"]
        assert result.get("clientSecret") is None
