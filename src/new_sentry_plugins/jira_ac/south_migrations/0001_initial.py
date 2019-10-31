# -*- coding: utf-8 -*-
from south.utils import datetime_utils as datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):
    def forwards(self, orm):
        # Adding model 'JiraTenant'
        db.create_table(
            "jira_ac_tenant",
            (
                (
                    "id",
                    self.gf("sentry.db.models.fields.bounded.BoundedBigAutoField")(
                        primary_key=True
                    ),
                ),
                (
                    "organization",
                    self.gf("sentry.db.models.fields.foreignkey.FlexibleForeignKey")(
                        blank=True,
                        related_name="jira_tenant_set",
                        null=True,
                        to=orm["sentry.Organization"],
                    ),
                ),
                (
                    "client_key",
                    self.gf("django.db.models.fields.CharField")(unique=True, max_length=50),
                ),
                ("secret", self.gf("django.db.models.fields.CharField")(max_length=100)),
                ("base_url", self.gf("django.db.models.fields.CharField")(max_length=60)),
                ("public_key", self.gf("django.db.models.fields.CharField")(max_length=250)),
            ),
        )
        db.send_create_signal("jira_ac", ["JiraTenant"])

    def backwards(self, orm):
        # Deleting model 'JiraTenant'
        db.delete_table("jira_ac_tenant")

    models = {
        "jira_ac.jiratenant": {
            "Meta": {"object_name": "JiraTenant", "db_table": "'jira_ac_tenant'"},
            "base_url": ("django.db.models.fields.CharField", [], {"max_length": "60"}),
            "client_key": (
                "django.db.models.fields.CharField",
                [],
                {"unique": "True", "max_length": "50"},
            ),
            "id": (
                "sentry.db.models.fields.bounded.BoundedBigAutoField",
                [],
                {"primary_key": "True"},
            ),
            "organization": (
                "sentry.db.models.fields.foreignkey.FlexibleForeignKey",
                [],
                {
                    "blank": "True",
                    "related_name": "'jira_tenant_set'",
                    "null": "True",
                    "to": "orm['sentry.Organization']",
                },
            ),
            "public_key": ("django.db.models.fields.CharField", [], {"max_length": "250"}),
            "secret": ("django.db.models.fields.CharField", [], {"max_length": "100"}),
        },
        "sentry.organization": {
            "Meta": {"object_name": "Organization"},
            "date_added": (
                "django.db.models.fields.DateTimeField",
                [],
                {"default": "datetime.datetime.now"},
            ),
            "default_role": (
                "django.db.models.fields.CharField",
                [],
                {"default": "'member'", "max_length": "32"},
            ),
            "flags": ("django.db.models.fields.BigIntegerField", [], {"default": "1"}),
            "id": (
                "sentry.db.models.fields.bounded.BoundedBigAutoField",
                [],
                {"primary_key": "True"},
            ),
            "members": (
                "django.db.models.fields.related.ManyToManyField",
                [],
                {
                    "related_name": "'org_memberships'",
                    "symmetrical": "False",
                    "through": "orm['sentry.OrganizationMember']",
                    "to": "orm['sentry.User']",
                },
            ),
            "name": ("django.db.models.fields.CharField", [], {"max_length": "64"}),
            "slug": (
                "django.db.models.fields.SlugField",
                [],
                {"unique": "True", "max_length": "50"},
            ),
            "status": (
                "sentry.db.models.fields.bounded.BoundedPositiveIntegerField",
                [],
                {"default": "0"},
            ),
        },
        "sentry.organizationmember": {
            "Meta": {
                "unique_together": "(('organization', 'user'), ('organization', 'email'))",
                "object_name": "OrganizationMember",
            },
            "date_added": (
                "django.db.models.fields.DateTimeField",
                [],
                {"default": "datetime.datetime.now"},
            ),
            "email": (
                "django.db.models.fields.EmailField",
                [],
                {"max_length": "75", "null": "True", "blank": "True"},
            ),
            "flags": ("django.db.models.fields.BigIntegerField", [], {"default": "0"}),
            "has_global_access": ("django.db.models.fields.BooleanField", [], {"default": "True"}),
            "id": (
                "sentry.db.models.fields.bounded.BoundedBigAutoField",
                [],
                {"primary_key": "True"},
            ),
            "organization": (
                "sentry.db.models.fields.foreignkey.FlexibleForeignKey",
                [],
                {"related_name": "'member_set'", "to": "orm['sentry.Organization']"},
            ),
            "role": (
                "django.db.models.fields.CharField",
                [],
                {"default": "'member'", "max_length": "32"},
            ),
            "teams": (
                "django.db.models.fields.related.ManyToManyField",
                [],
                {
                    "to": "orm['sentry.Team']",
                    "symmetrical": "False",
                    "through": "orm['sentry.OrganizationMemberTeam']",
                    "blank": "True",
                },
            ),
            "token": (
                "django.db.models.fields.CharField",
                [],
                {"max_length": "64", "unique": "True", "null": "True", "blank": "True"},
            ),
            "type": (
                "sentry.db.models.fields.bounded.BoundedPositiveIntegerField",
                [],
                {"default": "50", "blank": "True"},
            ),
            "user": (
                "sentry.db.models.fields.foreignkey.FlexibleForeignKey",
                [],
                {
                    "blank": "True",
                    "related_name": "'sentry_orgmember_set'",
                    "null": "True",
                    "to": "orm['sentry.User']",
                },
            ),
        },
        "sentry.organizationmemberteam": {
            "Meta": {
                "unique_together": "(('team', 'organizationmember'),)",
                "object_name": "OrganizationMemberTeam",
                "db_table": "'sentry_organizationmember_teams'",
            },
            "id": ("sentry.db.models.fields.bounded.BoundedAutoField", [], {"primary_key": "True"}),
            "is_active": ("django.db.models.fields.BooleanField", [], {"default": "True"}),
            "organizationmember": (
                "sentry.db.models.fields.foreignkey.FlexibleForeignKey",
                [],
                {"to": "orm['sentry.OrganizationMember']"},
            ),
            "team": (
                "sentry.db.models.fields.foreignkey.FlexibleForeignKey",
                [],
                {"to": "orm['sentry.Team']"},
            ),
        },
        "sentry.team": {
            "Meta": {"unique_together": "(('organization', 'slug'),)", "object_name": "Team"},
            "date_added": (
                "django.db.models.fields.DateTimeField",
                [],
                {"default": "datetime.datetime.now", "null": "True"},
            ),
            "id": (
                "sentry.db.models.fields.bounded.BoundedBigAutoField",
                [],
                {"primary_key": "True"},
            ),
            "name": ("django.db.models.fields.CharField", [], {"max_length": "64"}),
            "organization": (
                "sentry.db.models.fields.foreignkey.FlexibleForeignKey",
                [],
                {"to": "orm['sentry.Organization']"},
            ),
            "slug": ("django.db.models.fields.SlugField", [], {"max_length": "50"}),
            "status": (
                "sentry.db.models.fields.bounded.BoundedPositiveIntegerField",
                [],
                {"default": "0"},
            ),
        },
        "sentry.user": {
            "Meta": {"object_name": "User", "db_table": "'auth_user'"},
            "date_joined": (
                "django.db.models.fields.DateTimeField",
                [],
                {"default": "datetime.datetime.now"},
            ),
            "email": (
                "django.db.models.fields.EmailField",
                [],
                {"max_length": "75", "blank": "True"},
            ),
            "id": ("sentry.db.models.fields.bounded.BoundedAutoField", [], {"primary_key": "True"}),
            "is_active": ("django.db.models.fields.BooleanField", [], {"default": "True"}),
            "is_managed": ("django.db.models.fields.BooleanField", [], {"default": "False"}),
            "is_password_expired": (
                "django.db.models.fields.BooleanField",
                [],
                {"default": "False"},
            ),
            "is_staff": ("django.db.models.fields.BooleanField", [], {"default": "False"}),
            "is_superuser": ("django.db.models.fields.BooleanField", [], {"default": "False"}),
            "last_login": (
                "django.db.models.fields.DateTimeField",
                [],
                {"default": "datetime.datetime.now"},
            ),
            "last_password_change": ("django.db.models.fields.DateTimeField", [], {"null": "True"}),
            "name": (
                "django.db.models.fields.CharField",
                [],
                {"max_length": "200", "db_column": "'first_name'", "blank": "True"},
            ),
            "password": ("django.db.models.fields.CharField", [], {"max_length": "128"}),
            "username": (
                "django.db.models.fields.CharField",
                [],
                {"unique": "True", "max_length": "128"},
            ),
        },
    }

    complete_apps = ["jira_ac"]
