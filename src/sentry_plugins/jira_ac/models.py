from time import time

import jwt
from django.db import models

from sentry.db.models import FlexibleForeignKey, Model
from sentry_plugins.jira_ac.utils import get_query_hash


class JiraTenant(Model):
    __core__ = False
    organization = FlexibleForeignKey(
        "sentry.Organization", null=True, blank=True, related_name="jira_tenant_set"
    )
    client_key = models.CharField(max_length=50, unique=True)
    secret = models.CharField(max_length=100)
    base_url = models.CharField(max_length=60)
    public_key = models.CharField(max_length=250)

    class Meta:
        app_label = "jira_ac"
        db_table = "jira_ac_tenant"

    def get_token(self, issuer, uri, method):
        now = int(time())
        payload = {
            "iss": issuer,
            "iat": now,
            "exp": now + 60 * 60,
            "qsh": get_query_hash(uri, method),
            "aud": issuer,
        }
        return jwt.encode(payload, self.secret, algorithm="HS256")

    def is_configured(self):
        return self.organization is not None
