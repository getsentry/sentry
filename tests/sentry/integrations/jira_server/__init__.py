from __future__ import annotations

from typing import Any

from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.identity import Identity, IdentityProvider, IdentityStatus
from sentry.models.integrations.external_issue import ExternalIssue
from sentry.models.integrations.integration import Integration
from sentry.models.organization import Organization
from sentry.models.user import User

EXAMPLE_PRIVATE_KEY = """-----BEGIN RSA PRIVATE KEY-----
MIICWwIBAAKBgQC1cd9t8sA03awggLiX2gjZxyvOVUPJksLly1E662tttTeR3Wm9
eo6onNeI8HRD+O4wubUp4h4Chc7DtLDmFEPhUZ8Qkwztiifm99Xo3s0nUq4Pygp5
AU09KXTEPbzHLh1dnXLcxVLmGDE4drh0NWmYsd/Zp7XNIZq2TRQQ3NTdVQIDAQAB
AoGAFwMyS0eWiR30TssEnn3Q0Y4pSCoYRuCOR4bZ7pcdMPTi72UdnCKHJWt/Cqc0
l8piq1tiVsWO+NLvvnKUXRoE4cAyrGrpf1F0uP5zYW71SQALc9wwsjDzuj7BZEuK
fg35JSceLHWE1WtzPDX5Xg20YPnMrA/xe/RwuPjuBH0wSqECQQDizzmKdKCq0ejy
3OxEto5knqpSEgRcOk0HDsdgjwkwiZJOj5ECV2FKpNHuu2thGy/aDJyLlmUso8j0
OpvLAzOvAkEAzMwAgGexTxKm8hy3ilvVn9EvhSKjaIakqY4ONK9LZ4zMiDHI0H6C
FXlwWX7CJM0YVFMubj8SB8rnIuvFDEBMOwJABHtRyMGbNyTktH/XD1iIIcbc2LhQ
a74fLYeGOws4hEQDpxfBJsmxO3dcSppbedS+slFTepKjNymZW/IYh/9tMwJAEL5E
9DqGBn7x4y1x2//yESTbC7lvPqZzY+FXS/tg4NBkEGZxkoolPHg3NTnlyXhzGsHK
M/04DicKipJYA85l7QJAJ3u67qZXecM/oWTtJToBDuyKGHfdY1564+RbyDEjJJRb
vz4O/8FQQ1sGjdEBMMrRBCHEG8o3/XDTrB97t45TeA==
-----END RSA PRIVATE KEY-----"""

EXAMPLE_ISSUE_SEARCH = """
{
  "expand": "names,schema",
  "startAt": 0,
  "maxResults": 50,
  "total": 1,
  "issues": [
    {
      "expand": "",
      "id": "10001",
      "self": "http://www.example.com/jira/rest/api/2/issue/10001",
      "key": "HSP-1",
      "fields": {
        "summary": "this is a test issue summary"
      }
    }
  ],
  "warningMessages": [
    "The value 'splat' does not exist for the field 'Foo'."
  ]
}
"""

EXAMPLE_USER_SEARCH_RESPONSE = """
[
    {"name": "bob", "displayName": "Bobby", "emailAddress": "bob@example.org"}
]
"""

EXAMPLE_PAYLOAD: dict[str, Any] = {
    "changelog": {
        "items": [
            {
                "from": "10101",
                "field": "status",
                "fromString": "In Progress",
                "to": "10102",
                "toString": "Done",
                "fieldtype": "jira",
                "fieldId": "status",
            }
        ],
        "id": 12345,
    },
    "issue": {"project": {"key": "APP", "id": "10000"}, "key": "APP-1"},
}


def get_integration(organization: Organization, user: User) -> Integration:
    integration = Integration.objects.create(
        provider="jira_server",
        name="Example Jira",
        metadata={
            "verify_ssl": False,
            "webhook_secret": "a long secret value",
            "base_url": "https://jira.example.org",
        },
    )
    identity_provider = IdentityProvider.objects.create(
        external_id="jira.example.org:sentry-test", type="jira_server"
    )
    identity = Identity.objects.create(
        idp=identity_provider,
        user=user,
        scopes=(),
        status=IdentityStatus.VALID,
        data={
            "consumer_key": "sentry-test",
            "private_key": EXAMPLE_PRIVATE_KEY,
            "access_token": "access-token",
            "access_token_secret": "access-token-secret",
        },
    )
    integration.add_organization(organization, user, default_auth_id=identity.id)
    return integration


def link_group(organization: Organization, integration: Integration, group: Group) -> None:
    external_issue = ExternalIssue.objects.create(
        key=EXAMPLE_PAYLOAD["issue"]["key"],
        integration_id=integration.id,
        organization_id=organization.id,
    )

    GroupLink.objects.create(
        group_id=group.id,
        project_id=group.project_id,
        linked_type=GroupLink.LinkedType.issue,
        relationship=GroupLink.Relationship.resolves,
        linked_id=external_issue.id,
    )
