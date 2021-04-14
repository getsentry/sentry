from django.db import migrations, models
import bitfield.models
import sentry.models.scheduledeletion
import sentry.models.groupshare
import sentry.db.models.fields.uuid
import django.utils.timezone
import sentry.db.models.fields.citext
from django.conf import settings
import sentry.models.sentryappinstallation
import sentry.models.apigrant
import sentry.db.models.fields.gzippeddict
import sentry.models.apitoken
import sentry.models.apiapplication
import sentry.models.sentryapp
import sentry.db.models.fields.node
import sentry.db.mixin
import sentry.db.models.fields.bounded
import sentry.models.useremail
import sentry.models.broadcast
import sentry.db.models.fields.array
import sentry.db.models.fields.jsonfield
import sentry.models.servicehook
import sentry.db.models.fields.foreignkey
import django.db.models.deletion
import sentry.models.user
import sentry.models.event
import sentry.db.models.fields.encrypted


class Migration(migrations.Migration):

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="User",
            fields=[
                ("password", models.CharField(max_length=128, verbose_name="password")),
                (
                    "last_login",
                    models.DateTimeField(null=True, verbose_name="last login", blank=True),
                ),
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "username",
                    models.CharField(unique=True, max_length=128, verbose_name="username"),
                ),
                (
                    "name",
                    models.CharField(
                        max_length=200, verbose_name="name", db_column="first_name", blank=True
                    ),
                ),
                (
                    "email",
                    models.EmailField(max_length=75, verbose_name="email address", blank=True),
                ),
                (
                    "is_staff",
                    models.BooleanField(
                        default=False,
                        help_text="Designates whether the user can log into this admin site.",
                        verbose_name="staff status",
                    ),
                ),
                (
                    "is_active",
                    models.BooleanField(
                        default=True,
                        help_text="Designates whether this user should be treated as active. Unselect this instead of deleting accounts.",
                        verbose_name="active",
                    ),
                ),
                (
                    "is_superuser",
                    models.BooleanField(
                        default=False,
                        help_text="Designates that this user has all permissions without explicitly assigning them.",
                        verbose_name="superuser status",
                    ),
                ),
                (
                    "is_managed",
                    models.BooleanField(
                        default=False,
                        help_text="Designates whether this user should be treated as managed. Select this to disallow the user from modifying their account (username, password, etc).",
                        verbose_name="managed",
                    ),
                ),
                (
                    "is_sentry_app",
                    models.NullBooleanField(
                        default=None,
                        help_text="Designates whether this user is the entity used for Permissionson behalf of a Sentry App. Cannot login or use Sentry like anormal User would.",
                        verbose_name="is sentry app",
                    ),
                ),
                (
                    "is_password_expired",
                    models.BooleanField(
                        default=False,
                        help_text="If set to true then the user needs to change the password on next sign in.",
                        verbose_name="password expired",
                    ),
                ),
                (
                    "last_password_change",
                    models.DateTimeField(
                        help_text="The date the password was changed last.",
                        null=True,
                        verbose_name="date of last password change",
                    ),
                ),
                (
                    "flags",
                    bitfield.models.BitField(
                        (
                            (
                                "newsletter_consent_prompt",
                                "Do we need to ask this user for newsletter consent?",
                            ),
                        ),
                        default=0,
                        null=True,
                    ),
                ),
                ("session_nonce", models.CharField(max_length=12, null=True)),
                (
                    "date_joined",
                    models.DateTimeField(
                        default=django.utils.timezone.now, verbose_name="date joined"
                    ),
                ),
                (
                    "last_active",
                    models.DateTimeField(
                        default=django.utils.timezone.now, null=True, verbose_name="last active"
                    ),
                ),
            ],
            options={
                "db_table": "auth_user",
                "verbose_name": "user",
                "verbose_name_plural": "users",
            },
            managers=[("objects", sentry.models.user.UserManager(cache_fields=["pk"]))],
        ),
        migrations.CreateModel(
            name="Activity",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "type",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        choices=[
                            (1, "set_resolved"),
                            (15, "set_resolved_by_age"),
                            (13, "set_resolved_in_release"),
                            (16, "set_resolved_in_commit"),
                            (21, "set_resolved_in_pull_request"),
                            (2, "set_unresolved"),
                            (3, "set_ignored"),
                            (4, "set_public"),
                            (5, "set_private"),
                            (6, "set_regression"),
                            (7, "create_issue"),
                            (8, "note"),
                            (9, "first_seen"),
                            (10, "release"),
                            (11, "assigned"),
                            (12, "unassigned"),
                            (14, "merge"),
                            (17, "deploy"),
                            (18, "new_processing_issues"),
                            (19, "unmerge_source"),
                            (20, "unmerge_destination"),
                        ]
                    ),
                ),
                ("ident", models.CharField(max_length=64, null=True)),
                ("datetime", models.DateTimeField(default=django.utils.timezone.now)),
                ("data", sentry.db.models.fields.gzippeddict.GzippedDictField(null=True)),
            ],
            options={"db_table": "sentry_activity"},
        ),
        migrations.CreateModel(
            name="ApiApplication",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "client_id",
                    models.CharField(
                        default=sentry.models.apiapplication.generate_token,
                        unique=True,
                        max_length=64,
                    ),
                ),
                (
                    "client_secret",
                    sentry.db.models.fields.encrypted.EncryptedTextField(
                        default=sentry.models.apiapplication.generate_token
                    ),
                ),
                (
                    "name",
                    models.CharField(
                        default=sentry.models.apiapplication.generate_name,
                        max_length=64,
                        blank=True,
                    ),
                ),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0, db_index=True, choices=[(0, "Active"), (1, "Inactive")]
                    ),
                ),
                ("allowed_origins", models.TextField(null=True, blank=True)),
                ("redirect_uris", models.TextField()),
                ("homepage_url", models.URLField(null=True)),
                ("privacy_url", models.URLField(null=True)),
                ("terms_url", models.URLField(null=True)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "owner",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"db_table": "sentry_apiapplication"},
        ),
        migrations.CreateModel(
            name="ApiAuthorization",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "scopes",
                    bitfield.models.BitField(
                        (
                            ("project:read", "project:read"),
                            ("project:write", "project:write"),
                            ("project:admin", "project:admin"),
                            ("project:releases", "project:releases"),
                            ("team:read", "team:read"),
                            ("team:write", "team:write"),
                            ("team:admin", "team:admin"),
                            ("event:read", "event:read"),
                            ("event:write", "event:write"),
                            ("event:admin", "event:admin"),
                            ("org:read", "org:read"),
                            ("org:write", "org:write"),
                            ("org:admin", "org:admin"),
                            ("member:read", "member:read"),
                            ("member:write", "member:write"),
                            ("member:admin", "member:admin"),
                        ),
                        default=None,
                    ),
                ),
                ("scope_list", sentry.db.models.fields.array.ArrayField(null=True)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "application",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.ApiApplication", null=True
                    ),
                ),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"db_table": "sentry_apiauthorization"},
        ),
        migrations.CreateModel(
            name="ApiGrant",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "code",
                    models.CharField(
                        default=sentry.models.apigrant.generate_code, max_length=64, db_index=True
                    ),
                ),
                (
                    "expires_at",
                    models.DateTimeField(
                        default=sentry.models.apigrant.default_expiration, db_index=True
                    ),
                ),
                ("redirect_uri", models.CharField(max_length=255)),
                (
                    "scopes",
                    bitfield.models.BitField(
                        (
                            ("project:read", "project:read"),
                            ("project:write", "project:write"),
                            ("project:admin", "project:admin"),
                            ("project:releases", "project:releases"),
                            ("team:read", "team:read"),
                            ("team:write", "team:write"),
                            ("team:admin", "team:admin"),
                            ("event:read", "event:read"),
                            ("event:write", "event:write"),
                            ("event:admin", "event:admin"),
                            ("org:read", "org:read"),
                            ("org:write", "org:write"),
                            ("org:admin", "org:admin"),
                            ("member:read", "member:read"),
                            ("member:write", "member:write"),
                            ("member:admin", "member:admin"),
                        ),
                        default=None,
                    ),
                ),
                ("scope_list", sentry.db.models.fields.array.ArrayField(null=True)),
                (
                    "application",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.ApiApplication"
                    ),
                ),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"db_table": "sentry_apigrant"},
        ),
        migrations.CreateModel(
            name="ApiKey",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("label", models.CharField(default="Default", max_length=64, blank=True)),
                ("key", models.CharField(unique=True, max_length=32)),
                (
                    "scopes",
                    bitfield.models.BitField(
                        (
                            ("project:read", "project:read"),
                            ("project:write", "project:write"),
                            ("project:admin", "project:admin"),
                            ("project:releases", "project:releases"),
                            ("team:read", "team:read"),
                            ("team:write", "team:write"),
                            ("team:admin", "team:admin"),
                            ("event:read", "event:read"),
                            ("event:write", "event:write"),
                            ("event:admin", "event:admin"),
                            ("org:read", "org:read"),
                            ("org:write", "org:write"),
                            ("org:admin", "org:admin"),
                            ("member:read", "member:read"),
                            ("member:write", "member:write"),
                            ("member:admin", "member:admin"),
                        ),
                        default=None,
                    ),
                ),
                ("scope_list", sentry.db.models.fields.array.ArrayField(null=True)),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0, db_index=True, choices=[(0, "Active"), (1, "Inactive")]
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                ("allowed_origins", models.TextField(null=True, blank=True)),
            ],
            options={"db_table": "sentry_apikey"},
        ),
        migrations.CreateModel(
            name="ApiToken",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "scopes",
                    bitfield.models.BitField(
                        (
                            ("project:read", "project:read"),
                            ("project:write", "project:write"),
                            ("project:admin", "project:admin"),
                            ("project:releases", "project:releases"),
                            ("team:read", "team:read"),
                            ("team:write", "team:write"),
                            ("team:admin", "team:admin"),
                            ("event:read", "event:read"),
                            ("event:write", "event:write"),
                            ("event:admin", "event:admin"),
                            ("org:read", "org:read"),
                            ("org:write", "org:write"),
                            ("org:admin", "org:admin"),
                            ("member:read", "member:read"),
                            ("member:write", "member:write"),
                            ("member:admin", "member:admin"),
                        ),
                        default=None,
                    ),
                ),
                ("scope_list", sentry.db.models.fields.array.ArrayField(null=True)),
                (
                    "token",
                    models.CharField(
                        default=sentry.models.apitoken.generate_token, unique=True, max_length=64
                    ),
                ),
                (
                    "refresh_token",
                    models.CharField(
                        default=sentry.models.apitoken.generate_token,
                        max_length=64,
                        unique=True,
                        null=True,
                    ),
                ),
                (
                    "expires_at",
                    models.DateTimeField(
                        default=sentry.models.apitoken.default_expiration, null=True
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "application",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.ApiApplication", null=True
                    ),
                ),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"db_table": "sentry_apitoken"},
        ),
        migrations.CreateModel(
            name="AssistantActivity",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("guide_id", sentry.db.models.fields.bounded.BoundedPositiveIntegerField()),
                ("viewed_ts", models.DateTimeField(null=True)),
                ("dismissed_ts", models.DateTimeField(null=True)),
                ("useful", models.NullBooleanField()),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"db_table": "sentry_assistant_activity"},
        ),
        migrations.CreateModel(
            name="AuditLogEntry",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("actor_label", models.CharField(max_length=64, null=True, blank=True)),
                (
                    "target_object",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
                (
                    "event",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        choices=[
                            (1, "member.invite"),
                            (2, "member.add"),
                            (3, "member.accept-invite"),
                            (5, "member.remove"),
                            (4, "member.edit"),
                            (6, "member.join-team"),
                            (7, "member.leave-team"),
                            (8, "member.pending"),
                            (20, "team.create"),
                            (21, "team.edit"),
                            (22, "team.remove"),
                            (30, "project.create"),
                            (31, "project.edit"),
                            (32, "project.remove"),
                            (33, "project.set-public"),
                            (34, "project.set-private"),
                            (35, "project.request-transfer"),
                            (36, "project.accept-transfer"),
                            (10, "org.create"),
                            (11, "org.edit"),
                            (12, "org.remove"),
                            (13, "org.restore"),
                            (40, "tagkey.remove"),
                            (50, "projectkey.create"),
                            (51, "projectkey.edit"),
                            (52, "projectkey.remove"),
                            (53, "projectkey.enable"),
                            (53, "projectkey.disable"),
                            (60, "sso.enable"),
                            (61, "sso.disable"),
                            (62, "sso.edit"),
                            (63, "sso-identity.link"),
                            (70, "api-key.create"),
                            (71, "api-key.edit"),
                            (72, "api-key.remove"),
                            (80, "rule.create"),
                            (81, "rule.edit"),
                            (82, "rule.remove"),
                            (100, "serivcehook.create"),
                            (101, "serivcehook.edit"),
                            (102, "serivcehook.remove"),
                            (103, "serivcehook.enable"),
                            (104, "serivcehook.disable"),
                            (110, "integration.add"),
                            (111, "integration.edit"),
                            (112, "integration.remove"),
                            (113, "sentry-app.add"),
                            (115, "sentry-app.remove"),
                            (116, "sentry-app.install"),
                            (117, "sentry-app.uninstall"),
                            (90, "ondemand.edit"),
                            (91, "trial.started"),
                            (92, "plan.changed"),
                        ]
                    ),
                ),
                ("ip_address", models.GenericIPAddressField(null=True, unpack_ipv4=True)),
                ("data", sentry.db.models.fields.gzippeddict.GzippedDictField()),
                ("datetime", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "actor",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="audit_actors",
                        blank=True,
                        to=settings.AUTH_USER_MODEL,
                        null=True,
                    ),
                ),
                (
                    "actor_key",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        blank=True, to="sentry.ApiKey", null=True
                    ),
                ),
            ],
            options={"db_table": "sentry_auditlogentry"},
        ),
        migrations.CreateModel(
            name="Authenticator",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(
                        default=django.utils.timezone.now, verbose_name="created at"
                    ),
                ),
                ("last_used_at", models.DateTimeField(null=True, verbose_name="last used at")),
                (
                    "type",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        choices=[
                            (0, "Recovery Codes"),
                            (1, "Authenticator App"),
                            (2, "Text Message"),
                            (3, "U2F (Universal 2nd Factor)"),
                        ]
                    ),
                ),
                (
                    "config",
                    sentry.db.models.fields.encrypted.EncryptedPickledObjectField(editable=False),
                ),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={
                "db_table": "auth_authenticator",
                "verbose_name": "authenticator",
                "verbose_name_plural": "authenticators",
            },
        ),
        migrations.CreateModel(
            name="AuthIdentity",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("ident", models.CharField(max_length=128)),
                ("data", sentry.db.models.fields.encrypted.EncryptedJsonField(default=dict)),
                ("last_verified", models.DateTimeField(default=django.utils.timezone.now)),
                ("last_synced", models.DateTimeField(default=django.utils.timezone.now)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_authidentity"},
        ),
        migrations.CreateModel(
            name="AuthProvider",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("provider", models.CharField(max_length=128)),
                ("config", sentry.db.models.fields.encrypted.EncryptedJsonField(default=dict)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "sync_time",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
                ("last_sync", models.DateTimeField(null=True)),
                (
                    "default_role",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(default=50),
                ),
                ("default_global_access", models.BooleanField(default=True)),
                (
                    "flags",
                    bitfield.models.BitField(
                        (
                            (
                                "allow_unlinked",
                                "Grant access to members who have not linked SSO accounts.",
                            ),
                        ),
                        default=0,
                    ),
                ),
            ],
            options={"db_table": "sentry_authprovider"},
        ),
        migrations.CreateModel(
            name="Broadcast",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("upstream_id", models.CharField(max_length=32, null=True, blank=True)),
                ("title", models.CharField(max_length=32)),
                ("message", models.CharField(max_length=256)),
                ("link", models.URLField(null=True, blank=True)),
                ("is_active", models.BooleanField(default=True, db_index=True)),
                (
                    "date_expires",
                    models.DateTimeField(
                        default=sentry.models.broadcast.default_expiration, null=True, blank=True
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_broadcast"},
        ),
        migrations.CreateModel(
            name="BroadcastSeen",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("date_seen", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "broadcast",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Broadcast"),
                ),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"db_table": "sentry_broadcastseen"},
        ),
        migrations.CreateModel(
            name="Commit",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "organization_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                ("repository_id", sentry.db.models.fields.bounded.BoundedPositiveIntegerField()),
                ("key", models.CharField(max_length=64)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                ("message", models.TextField(null=True)),
            ],
            options={"db_table": "sentry_commit"},
        ),
        migrations.CreateModel(
            name="CommitAuthor",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "organization_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                ("name", models.CharField(max_length=128, null=True)),
                ("email", models.EmailField(max_length=75)),
                ("external_id", models.CharField(max_length=164, null=True)),
            ],
            options={"db_table": "sentry_commitauthor"},
        ),
        migrations.CreateModel(
            name="CommitFileChange",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "organization_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                ("filename", models.TextField()),
                (
                    "type",
                    models.CharField(
                        max_length=1, choices=[("A", "Added"), ("D", "Deleted"), ("M", "Modified")]
                    ),
                ),
                (
                    "commit",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Commit"),
                ),
            ],
            options={"db_table": "sentry_commitfilechange"},
        ),
        migrations.CreateModel(
            name="Counter",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("value", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
            ],
            options={"db_table": "sentry_projectcounter"},
        ),
        migrations.CreateModel(
            name="Dashboard",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("title", models.CharField(max_length=255)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0,
                        choices=[
                            (0, "active"),
                            (1, "disabled"),
                            (2, "pending_deletion"),
                            (3, "deletion_in_progress"),
                        ],
                    ),
                ),
                (
                    "created_by",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"db_table": "sentry_dashboard"},
        ),
        migrations.CreateModel(
            name="DeletedOrganization",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("actor_label", models.CharField(max_length=64, null=True)),
                ("actor_id", sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True)),
                ("actor_key", models.CharField(max_length=32, null=True)),
                ("ip_address", models.GenericIPAddressField(null=True, unpack_ipv4=True)),
                ("date_deleted", models.DateTimeField(default=django.utils.timezone.now)),
                ("date_created", models.DateTimeField(null=True)),
                ("reason", models.TextField(null=True, blank=True)),
                ("name", models.CharField(max_length=64, null=True)),
                ("slug", models.CharField(max_length=50, null=True)),
            ],
            options={"db_table": "sentry_deletedorganization"},
        ),
        migrations.CreateModel(
            name="DeletedProject",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("actor_label", models.CharField(max_length=64, null=True)),
                ("actor_id", sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True)),
                ("actor_key", models.CharField(max_length=32, null=True)),
                ("ip_address", models.GenericIPAddressField(null=True, unpack_ipv4=True)),
                ("date_deleted", models.DateTimeField(default=django.utils.timezone.now)),
                ("date_created", models.DateTimeField(null=True)),
                ("reason", models.TextField(null=True, blank=True)),
                ("slug", models.CharField(max_length=50, null=True)),
                ("name", models.CharField(max_length=200, null=True)),
                (
                    "organization_id",
                    sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True),
                ),
                ("organization_name", models.CharField(max_length=64, null=True)),
                ("organization_slug", models.CharField(max_length=50, null=True)),
                ("platform", models.CharField(max_length=64, null=True)),
            ],
            options={"db_table": "sentry_deletedproject"},
        ),
        migrations.CreateModel(
            name="DeletedTeam",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("actor_label", models.CharField(max_length=64, null=True)),
                ("actor_id", sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True)),
                ("actor_key", models.CharField(max_length=32, null=True)),
                ("ip_address", models.GenericIPAddressField(null=True, unpack_ipv4=True)),
                ("date_deleted", models.DateTimeField(default=django.utils.timezone.now)),
                ("date_created", models.DateTimeField(null=True)),
                ("reason", models.TextField(null=True, blank=True)),
                ("name", models.CharField(max_length=64, null=True)),
                ("slug", models.CharField(max_length=50, null=True)),
                (
                    "organization_id",
                    sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True),
                ),
                ("organization_name", models.CharField(max_length=64, null=True)),
                ("organization_slug", models.CharField(max_length=50, null=True)),
            ],
            options={"db_table": "sentry_deletedteam"},
        ),
        migrations.CreateModel(
            name="Deploy",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "organization_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                (
                    "environment_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                ("date_finished", models.DateTimeField(default=django.utils.timezone.now)),
                ("date_started", models.DateTimeField(null=True, blank=True)),
                ("name", models.CharField(max_length=64, null=True, blank=True)),
                ("url", models.URLField(null=True, blank=True)),
                ("notified", models.NullBooleanField(default=False, db_index=True)),
            ],
            options={"db_table": "sentry_deploy"},
        ),
        migrations.CreateModel(
            name="DiscoverSavedQuery",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                ("query", sentry.db.models.fields.jsonfield.JSONField(default=dict)),
                ("date_created", models.DateTimeField(auto_now_add=True)),
                ("date_updated", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        on_delete=django.db.models.deletion.SET_NULL,
                        to=settings.AUTH_USER_MODEL,
                        null=True,
                    ),
                ),
            ],
            options={"db_table": "sentry_discoversavedquery"},
        ),
        migrations.CreateModel(
            name="DiscoverSavedQueryProject",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "discover_saved_query",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.DiscoverSavedQuery"
                    ),
                ),
            ],
            options={"db_table": "sentry_discoversavedqueryproject"},
        ),
        migrations.CreateModel(
            name="Distribution",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "organization_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                ("name", models.CharField(max_length=64)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_distribution"},
        ),
        migrations.CreateModel(
            name="Email",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "email",
                    sentry.db.models.fields.citext.CIEmailField(
                        unique=True, max_length=75, verbose_name="email address"
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_email"},
        ),
        migrations.CreateModel(
            name="Environment",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("organization_id", sentry.db.models.fields.bounded.BoundedPositiveIntegerField()),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
                ("name", models.CharField(max_length=64)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_environment"},
        ),
        migrations.CreateModel(
            name="EnvironmentProject",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("is_hidden", models.NullBooleanField()),
                (
                    "environment",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Environment"),
                ),
            ],
            options={"db_table": "sentry_environmentproject"},
        ),
        migrations.CreateModel(
            name="Event",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "group_id",
                    sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True, blank=True),
                ),
                ("event_id", models.CharField(max_length=32, null=True, db_column="message_id")),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True, blank=True),
                ),
                ("message", models.TextField()),
                ("platform", models.CharField(max_length=64, null=True)),
                (
                    "datetime",
                    models.DateTimeField(default=django.utils.timezone.now, db_index=True),
                ),
                ("time_spent", sentry.db.models.fields.bounded.BoundedIntegerField(null=True)),
                ("data", sentry.db.models.fields.node.NodeField(null=True, blank=True)),
            ],
            options={
                "db_table": "sentry_message",
                "verbose_name": "message",
                "verbose_name_plural": "messages",
            },
        ),
        migrations.CreateModel(
            name="EventAttachment",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("project_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                (
                    "group_id",
                    sentry.db.models.fields.bounded.BoundedBigIntegerField(
                        null=True, db_index=True
                    ),
                ),
                ("event_id", models.CharField(max_length=32, db_index=True)),
                ("name", models.TextField()),
                (
                    "date_added",
                    models.DateTimeField(default=django.utils.timezone.now, db_index=True),
                ),
            ],
            options={"db_table": "sentry_eventattachment"},
        ),
        migrations.CreateModel(
            name="EventMapping",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("project_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                ("group_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                ("event_id", models.CharField(max_length=32)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_eventmapping"},
        ),
        migrations.CreateModel(
            name="EventProcessingIssue",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                )
            ],
            options={"db_table": "sentry_eventprocessingissue"},
        ),
        migrations.CreateModel(
            name="EventTag",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("project_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                ("group_id", sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True)),
                ("event_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                ("key_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                ("value_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                (
                    "date_added",
                    models.DateTimeField(default=django.utils.timezone.now, db_index=True),
                ),
            ],
            options={"db_table": "sentry_eventtag"},
        ),
        migrations.CreateModel(
            name="EventUser",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                ("hash", models.CharField(max_length=32)),
                ("ident", models.CharField(max_length=128, null=True)),
                ("email", models.EmailField(max_length=75, null=True)),
                ("username", models.CharField(max_length=128, null=True)),
                ("name", models.CharField(max_length=128, null=True)),
                ("ip_address", models.GenericIPAddressField(null=True)),
                (
                    "date_added",
                    models.DateTimeField(default=django.utils.timezone.now, db_index=True),
                ),
            ],
            options={"db_table": "sentry_eventuser"},
        ),
        migrations.CreateModel(
            name="ExternalIssue",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("organization_id", sentry.db.models.fields.bounded.BoundedPositiveIntegerField()),
                ("integration_id", sentry.db.models.fields.bounded.BoundedPositiveIntegerField()),
                ("key", models.CharField(max_length=128)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                ("title", models.TextField(null=True)),
                ("description", models.TextField(null=True)),
                ("metadata", sentry.db.models.fields.jsonfield.JSONField(null=True)),
            ],
            options={"db_table": "sentry_externalissue"},
        ),
        migrations.CreateModel(
            name="FeatureAdoption",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "feature_id",
                    models.PositiveIntegerField(
                        choices=[
                            (0, "Python"),
                            (1, "JavaScript"),
                            (2, "Node.js"),
                            (3, "Ruby"),
                            (4, "Java"),
                            (5, "Cocoa"),
                            (6, "Objective-C"),
                            (7, "PHP"),
                            (8, "Go"),
                            (9, "C#"),
                            (10, "Perl"),
                            (11, "Elixir"),
                            (12, "CFML"),
                            (13, "Groovy"),
                            (14, "CSP Reports"),
                            (20, "Flask"),
                            (21, "Django"),
                            (22, "Celery"),
                            (23, "Bottle"),
                            (24, "Pylons"),
                            (25, "Tornado"),
                            (26, "web.py"),
                            (27, "Zope"),
                            (40, "First Event"),
                            (41, "Release Tracking"),
                            (42, "Environment Tracking"),
                            (43, "User Tracking"),
                            (44, "Custom Tags"),
                            (45, "Source Maps"),
                            (46, "User Feedback"),
                            (48, "Breadcrumbs"),
                            (49, "Resolve with Commit"),
                            (60, "First Project"),
                            (61, "Invite Team"),
                            (62, "Assign Issue"),
                            (63, "Resolve in Next Release"),
                            (64, "Advanced Search"),
                            (65, "Saved Search"),
                            (66, "Inbound Filters"),
                            (67, "Alert Rules"),
                            (68, "Issue Tracker Integration"),
                            (69, "Notification Integration"),
                            (70, "Delete and Discard Future Events"),
                            (71, "Link a Repository"),
                            (72, "Ownership Rules"),
                            (73, "Ignore Issue"),
                            (80, "SSO"),
                            (81, "Data Scrubbers"),
                            (90, "Create Release Using API"),
                            (91, "Create Deploy Using API"),
                        ]
                    ),
                ),
                ("date_completed", models.DateTimeField(default=django.utils.timezone.now)),
                ("complete", models.BooleanField(default=False)),
                ("applicable", models.BooleanField(default=True)),
                ("data", sentry.db.models.fields.jsonfield.JSONField(default=dict)),
            ],
            options={"db_table": "sentry_featureadoption"},
        ),
        migrations.CreateModel(
            name="File",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("name", models.TextField()),
                ("type", models.CharField(max_length=64)),
                (
                    "timestamp",
                    models.DateTimeField(default=django.utils.timezone.now, db_index=True),
                ),
                ("headers", sentry.db.models.fields.jsonfield.JSONField(default=dict)),
                ("size", sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True)),
                ("checksum", models.CharField(max_length=40, null=True, db_index=True)),
                ("path", models.TextField(null=True)),
            ],
            options={"db_table": "sentry_file"},
        ),
        migrations.CreateModel(
            name="FileBlob",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("path", models.TextField(null=True)),
                ("size", sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True)),
                ("checksum", models.CharField(unique=True, max_length=40)),
                (
                    "timestamp",
                    models.DateTimeField(default=django.utils.timezone.now, db_index=True),
                ),
            ],
            options={"db_table": "sentry_fileblob"},
        ),
        migrations.CreateModel(
            name="FileBlobIndex",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("offset", sentry.db.models.fields.bounded.BoundedPositiveIntegerField()),
                (
                    "blob",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.FileBlob"),
                ),
                ("file", sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.File")),
            ],
            options={"db_table": "sentry_fileblobindex"},
        ),
        migrations.CreateModel(
            name="FileBlobOwner",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "blob",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.FileBlob"),
                ),
            ],
            options={"db_table": "sentry_fileblobowner"},
        ),
        migrations.CreateModel(
            name="Group",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("logger", models.CharField(default="", max_length=64, db_index=True, blank=True)),
                (
                    "level",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=40,
                        blank=True,
                        db_index=True,
                        choices=[
                            (0, "sample"),
                            (10, "debug"),
                            (20, "info"),
                            (30, "warning"),
                            (40, "error"),
                            (50, "fatal"),
                        ],
                    ),
                ),
                ("message", models.TextField()),
                (
                    "culprit",
                    models.CharField(max_length=200, null=True, db_column="view", blank=True),
                ),
                (
                    "num_comments",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0, null=True
                    ),
                ),
                ("platform", models.CharField(max_length=64, null=True)),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0,
                        db_index=True,
                        choices=[(0, "Unresolved"), (1, "Resolved"), (2, "Ignored")],
                    ),
                ),
                (
                    "times_seen",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=1, db_index=True
                    ),
                ),
                (
                    "last_seen",
                    models.DateTimeField(default=django.utils.timezone.now, db_index=True),
                ),
                (
                    "first_seen",
                    models.DateTimeField(default=django.utils.timezone.now, db_index=True),
                ),
                ("resolved_at", models.DateTimeField(null=True, db_index=True)),
                ("active_at", models.DateTimeField(null=True, db_index=True)),
                (
                    "time_spent_total",
                    sentry.db.models.fields.bounded.BoundedIntegerField(default=0),
                ),
                (
                    "time_spent_count",
                    sentry.db.models.fields.bounded.BoundedIntegerField(default=0),
                ),
                ("score", sentry.db.models.fields.bounded.BoundedIntegerField(default=0)),
                ("is_public", models.NullBooleanField(default=False)),
                (
                    "data",
                    sentry.db.models.fields.gzippeddict.GzippedDictField(null=True, blank=True),
                ),
                ("short_id", sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True)),
            ],
            options={
                "verbose_name_plural": "grouped messages",
                "db_table": "sentry_groupedmessage",
                "verbose_name": "grouped message",
                "permissions": (("can_view", "Can view"),),
            },
        ),
        migrations.CreateModel(
            name="GroupAssignee",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "group",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="assignee_set", to="sentry.Group", unique=True
                    ),
                ),
            ],
            options={"db_table": "sentry_groupasignee"},
        ),
        migrations.CreateModel(
            name="GroupBookmark",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now, null=True)),
                (
                    "group",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="bookmark_set", to="sentry.Group"
                    ),
                ),
            ],
            options={"db_table": "sentry_groupbookmark"},
        ),
        migrations.CreateModel(
            name="GroupCommitResolution",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("group_id", sentry.db.models.fields.bounded.BoundedPositiveIntegerField()),
                (
                    "commit_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                (
                    "datetime",
                    models.DateTimeField(default=django.utils.timezone.now, db_index=True),
                ),
            ],
            options={"db_table": "sentry_groupcommitresolution"},
        ),
        migrations.CreateModel(
            name="GroupEmailThread",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("email", models.EmailField(max_length=75)),
                ("msgid", models.CharField(max_length=100)),
                ("date", models.DateTimeField(default=django.utils.timezone.now, db_index=True)),
                (
                    "group",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="groupemail_set", to="sentry.Group"
                    ),
                ),
            ],
            options={"db_table": "sentry_groupemailthread"},
        ),
        migrations.CreateModel(
            name="GroupEnvironment",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "first_seen",
                    models.DateTimeField(
                        default=django.utils.timezone.now, null=True, db_index=True
                    ),
                ),
                (
                    "environment",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Environment", db_constraint=False
                    ),
                ),
            ],
            options={"db_table": "sentry_groupenvironment"},
        ),
        migrations.CreateModel(
            name="GroupHash",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("hash", models.CharField(max_length=32)),
                (
                    "group_tombstone_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        null=True, db_index=True
                    ),
                ),
                (
                    "state",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        null=True, choices=[(1, "Locked (Migration in Progress)")]
                    ),
                ),
                (
                    "group",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Group", null=True
                    ),
                ),
            ],
            options={"db_table": "sentry_grouphash"},
        ),
        migrations.CreateModel(
            name="GroupLink",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("group_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedBigIntegerField(db_index=True),
                ),
                (
                    "linked_type",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=1,
                        choices=[(1, "Commit"), (2, "Pull Request"), (3, "Tracker Issue")],
                    ),
                ),
                ("linked_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                (
                    "relationship",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=2, choices=[(1, "Resolves"), (2, "Linked")]
                    ),
                ),
                ("data", sentry.db.models.fields.jsonfield.JSONField(default=dict)),
                (
                    "datetime",
                    models.DateTimeField(default=django.utils.timezone.now, db_index=True),
                ),
            ],
            options={"db_table": "sentry_grouplink"},
        ),
        migrations.CreateModel(
            name="GroupMeta",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("key", models.CharField(max_length=64)),
                ("value", models.TextField()),
                ("group", sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Group")),
            ],
            options={"db_table": "sentry_groupmeta"},
        ),
        migrations.CreateModel(
            name="GroupRedirect",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("group_id", sentry.db.models.fields.bounded.BoundedBigIntegerField(db_index=True)),
                (
                    "previous_group_id",
                    sentry.db.models.fields.bounded.BoundedBigIntegerField(unique=True),
                ),
            ],
            options={"db_table": "sentry_groupredirect"},
        ),
        migrations.CreateModel(
            name="GroupRelease",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                ("group_id", sentry.db.models.fields.bounded.BoundedPositiveIntegerField()),
                (
                    "release_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                ("environment", models.CharField(default="", max_length=64)),
                ("first_seen", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "last_seen",
                    models.DateTimeField(default=django.utils.timezone.now, db_index=True),
                ),
            ],
            options={"db_table": "sentry_grouprelease"},
        ),
        migrations.CreateModel(
            name="GroupResolution",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "type",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        null=True, choices=[(1, "in_next_release"), (0, "in_release")]
                    ),
                ),
                (
                    "actor_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
                (
                    "datetime",
                    models.DateTimeField(default=django.utils.timezone.now, db_index=True),
                ),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0, choices=[(0, "Pending"), (1, "Resolved")]
                    ),
                ),
                (
                    "group",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Group", unique=True
                    ),
                ),
            ],
            options={"db_table": "sentry_groupresolution"},
        ),
        migrations.CreateModel(
            name="GroupRuleStatus",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("status", models.PositiveSmallIntegerField(default=0)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                ("last_active", models.DateTimeField(null=True)),
                ("group", sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Group")),
            ],
            options={"db_table": "sentry_grouprulestatus"},
        ),
        migrations.CreateModel(
            name="GroupSeen",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("last_seen", models.DateTimeField(default=django.utils.timezone.now)),
                ("group", sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Group")),
            ],
            options={"db_table": "sentry_groupseen"},
        ),
        migrations.CreateModel(
            name="GroupShare",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "uuid",
                    models.CharField(
                        default=sentry.models.groupshare.default_uuid, unique=True, max_length=32
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "group",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Group", unique=True
                    ),
                ),
            ],
            options={"db_table": "sentry_groupshare"},
        ),
        migrations.CreateModel(
            name="GroupSnooze",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("until", models.DateTimeField(null=True)),
                ("count", sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True)),
                ("window", sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True)),
                (
                    "user_count",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
                (
                    "user_window",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
                ("state", sentry.db.models.fields.jsonfield.JSONField(null=True)),
                (
                    "actor_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
                (
                    "group",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Group", unique=True
                    ),
                ),
            ],
            options={"db_table": "sentry_groupsnooze"},
        ),
        migrations.CreateModel(
            name="GroupSubscription",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("reason", sentry.db.models.fields.bounded.BoundedPositiveIntegerField(default=0)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now, null=True)),
                (
                    "group",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="subscription_set", to="sentry.Group"
                    ),
                ),
            ],
            options={"db_table": "sentry_groupsubscription"},
        ),
        migrations.CreateModel(
            name="GroupTagKey",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedBigIntegerField(
                        null=True, db_index=True
                    ),
                ),
                ("group_id", sentry.db.models.fields.bounded.BoundedBigIntegerField(db_index=True)),
                ("key", models.CharField(max_length=32)),
                (
                    "values_seen",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(default=0),
                ),
            ],
            options={"db_table": "sentry_grouptagkey"},
        ),
        migrations.CreateModel(
            name="GroupTagValue",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedBigIntegerField(
                        null=True, db_index=True
                    ),
                ),
                ("group_id", sentry.db.models.fields.bounded.BoundedBigIntegerField(db_index=True)),
                (
                    "times_seen",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(default=0),
                ),
                ("key", models.CharField(max_length=32)),
                ("value", models.CharField(max_length=200)),
                (
                    "last_seen",
                    models.DateTimeField(
                        default=django.utils.timezone.now, null=True, db_index=True
                    ),
                ),
                (
                    "first_seen",
                    models.DateTimeField(
                        default=django.utils.timezone.now, null=True, db_index=True
                    ),
                ),
            ],
            options={"db_table": "sentry_messagefiltervalue"},
        ),
        migrations.CreateModel(
            name="GroupTombstone",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "previous_group_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(unique=True),
                ),
                (
                    "level",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=40,
                        blank=True,
                        choices=[
                            (0, "sample"),
                            (10, "debug"),
                            (20, "info"),
                            (30, "warning"),
                            (40, "error"),
                            (50, "fatal"),
                        ],
                    ),
                ),
                ("message", models.TextField()),
                ("culprit", models.CharField(max_length=200, null=True, blank=True)),
                (
                    "data",
                    sentry.db.models.fields.gzippeddict.GzippedDictField(null=True, blank=True),
                ),
                (
                    "actor_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
            ],
            options={"db_table": "sentry_grouptombstone"},
        ),
        migrations.CreateModel(
            name="Identity",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("external_id", models.CharField(max_length=64)),
                ("data", sentry.db.models.fields.encrypted.EncryptedJsonField(default=dict)),
                ("status", sentry.db.models.fields.bounded.BoundedPositiveIntegerField(default=0)),
                ("scopes", sentry.db.models.fields.array.ArrayField(null=True)),
                ("date_verified", models.DateTimeField(default=django.utils.timezone.now)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_identity"},
        ),
        migrations.CreateModel(
            name="IdentityProvider",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("type", models.CharField(max_length=64)),
                ("config", sentry.db.models.fields.encrypted.EncryptedJsonField(default=dict)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now, null=True)),
                ("external_id", models.CharField(max_length=64, null=True)),
            ],
            options={"db_table": "sentry_identityprovider"},
        ),
        migrations.CreateModel(
            name="Integration",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("provider", models.CharField(max_length=64)),
                ("external_id", models.CharField(max_length=64)),
                ("name", models.CharField(max_length=200)),
                ("metadata", sentry.db.models.fields.encrypted.EncryptedJsonField(default=dict)),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0,
                        null=True,
                        choices=[
                            (0, "active"),
                            (1, "disabled"),
                            (2, "pending_deletion"),
                            (3, "deletion_in_progress"),
                        ],
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now, null=True)),
            ],
            options={"db_table": "sentry_integration"},
        ),
        migrations.CreateModel(
            name="IntegrationExternalProject",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "organization_integration_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                ("name", models.CharField(max_length=128)),
                ("external_id", models.CharField(max_length=64)),
                ("resolved_status", models.CharField(max_length=64)),
                ("unresolved_status", models.CharField(max_length=64)),
            ],
            options={"db_table": "sentry_integrationexternalproject"},
        ),
        migrations.CreateModel(
            name="LatestRelease",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("repository_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                ("environment_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                ("release_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                ("deploy_id", sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True)),
                ("commit_id", sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True)),
            ],
            options={"db_table": "sentry_latestrelease"},
        ),
        migrations.CreateModel(
            name="LostPasswordHash",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("hash", models.CharField(max_length=32)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL, unique=True
                    ),
                ),
            ],
            options={"db_table": "sentry_lostpasswordhash"},
        ),
        migrations.CreateModel(
            name="Monitor",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "guid",
                    sentry.db.models.fields.uuid.UUIDField(
                        unique=True, max_length=32, editable=False
                    ),
                ),
                (
                    "organization_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                ("name", models.CharField(max_length=128)),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0,
                        choices=[
                            (0, "active"),
                            (1, "disabled"),
                            (2, "pending_deletion"),
                            (3, "deletion_in_progress"),
                            (4, "ok"),
                            (5, "error"),
                        ],
                    ),
                ),
                (
                    "type",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0,
                        choices=[
                            (0, "unknown"),
                            (1, "health_check"),
                            (2, "heartbeat"),
                            (3, "cron_job"),
                        ],
                    ),
                ),
                ("config", sentry.db.models.fields.encrypted.EncryptedJsonField(default=dict)),
                ("next_checkin", models.DateTimeField(null=True)),
                ("last_checkin", models.DateTimeField(null=True)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_monitor"},
        ),
        migrations.CreateModel(
            name="MonitorCheckIn",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "guid",
                    sentry.db.models.fields.uuid.UUIDField(
                        unique=True, max_length=32, editable=False
                    ),
                ),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0,
                        choices=[(0, "unknown"), (1, "ok"), (2, "error"), (3, "in_progress")],
                    ),
                ),
                ("config", sentry.db.models.fields.encrypted.EncryptedJsonField(default=dict)),
                (
                    "duration",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                ("date_updated", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_monitorcheckin"},
        ),
        migrations.CreateModel(
            name="MonitorLocation",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "guid",
                    sentry.db.models.fields.uuid.UUIDField(
                        unique=True, max_length=32, editable=False
                    ),
                ),
                ("name", models.CharField(max_length=128)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_monitorlocation"},
        ),
        migrations.CreateModel(
            name="Option",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("key", models.CharField(unique=True, max_length=64)),
                (
                    "value",
                    sentry.db.models.fields.encrypted.EncryptedPickledObjectField(editable=False),
                ),
                ("last_updated", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_option"},
        ),
        migrations.CreateModel(
            name="Organization",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("name", models.CharField(max_length=64)),
                ("slug", models.SlugField(unique=True)),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0,
                        choices=[
                            (0, "active"),
                            (1, "pending deletion"),
                            (2, "deletion in progress"),
                        ],
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "default_role",
                    models.CharField(
                        default="member",
                        max_length=32,
                        choices=[
                            ("member", "Member"),
                            ("admin", "Admin"),
                            ("manager", "Manager"),
                            ("owner", "Owner"),
                        ],
                    ),
                ),
                (
                    "flags",
                    bitfield.models.BitField(
                        (
                            (
                                "allow_joinleave",
                                "Allow members to join and leave teams without requiring approval.",
                            ),
                            (
                                "enhanced_privacy",
                                "Enable enhanced privacy controls to limit personally identifiable information (PII) as well as source code in things like notifications.",
                            ),
                            (
                                "disable_shared_issues",
                                "Disable sharing of limited details on issues to anonymous users.",
                            ),
                            (
                                "early_adopter",
                                "Enable early adopter status, gaining access to features prior to public release.",
                            ),
                            (
                                "require_2fa",
                                "Require and enforce two-factor authentication for all members.",
                            ),
                            (
                                "disable_new_visibility_features",
                                "Temporarily opt out of new visibility features and ui",
                            ),
                        ),
                        default=1,
                    ),
                ),
            ],
            options={"db_table": "sentry_organization"},
        ),
        migrations.CreateModel(
            name="OrganizationAccessRequest",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                )
            ],
            options={"db_table": "sentry_organizationaccessrequest"},
        ),
        migrations.CreateModel(
            name="OrganizationAvatar",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("ident", models.CharField(unique=True, max_length=32, db_index=True)),
                (
                    "avatar_type",
                    models.PositiveSmallIntegerField(
                        default=0, choices=[(0, "letter_avatar"), (1, "upload")]
                    ),
                ),
                (
                    "file",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="sentry.File",
                        unique=True,
                    ),
                ),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="avatar", to="sentry.Organization", unique=True
                    ),
                ),
            ],
            options={"db_table": "sentry_organizationavatar"},
        ),
        migrations.CreateModel(
            name="OrganizationIntegration",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("config", sentry.db.models.fields.encrypted.EncryptedJsonField(default=dict)),
                (
                    "default_auth_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        null=True, db_index=True
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now, null=True)),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0,
                        choices=[
                            (0, "active"),
                            (1, "disabled"),
                            (2, "pending_deletion"),
                            (3, "deletion_in_progress"),
                        ],
                    ),
                ),
                (
                    "integration",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Integration"),
                ),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Organization"),
                ),
            ],
            options={"db_table": "sentry_organizationintegration"},
        ),
        migrations.CreateModel(
            name="OrganizationMember",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("email", models.EmailField(max_length=75, null=True, blank=True)),
                (
                    "role",
                    models.CharField(
                        default="member",
                        max_length=32,
                        choices=[
                            ("member", "Member"),
                            ("admin", "Admin"),
                            ("manager", "Manager"),
                            ("owner", "Owner"),
                        ],
                    ),
                ),
                (
                    "flags",
                    bitfield.models.BitField(
                        (("sso:linked", "sso:linked"), ("sso:invalid", "sso:invalid")), default=0
                    ),
                ),
                ("token", models.CharField(max_length=64, unique=True, null=True, blank=True)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                ("token_expires_at", models.DateTimeField(default=None, null=True)),
                ("has_global_access", models.BooleanField(default=True)),
                (
                    "type",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=50, blank=True
                    ),
                ),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="member_set", to="sentry.Organization"
                    ),
                ),
            ],
            options={"db_table": "sentry_organizationmember"},
        ),
        migrations.CreateModel(
            name="OrganizationMemberTeam",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                (
                    "organizationmember",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.OrganizationMember"
                    ),
                ),
            ],
            options={"db_table": "sentry_organizationmember_teams"},
        ),
        migrations.CreateModel(
            name="OrganizationOnboardingTask",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "task",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        choices=[
                            (2, "First event"),
                            (3, "Invite member"),
                            (9, "Issue tracker"),
                            (10, "Notification services"),
                            (4, "Second platform"),
                            (5, "User context"),
                            (7, "Upload sourcemaps"),
                            (6, "Release tracking"),
                            (8, "User reports"),
                        ]
                    ),
                ),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        choices=[(1, "Complete"), (2, "Pending"), (3, "Skipped")]
                    ),
                ),
                ("date_completed", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True, blank=True),
                ),
                ("data", sentry.db.models.fields.jsonfield.JSONField(default=dict)),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Organization"),
                ),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL, null=True
                    ),
                ),
            ],
            options={"db_table": "sentry_organizationonboardingtask"},
        ),
        migrations.CreateModel(
            name="OrganizationOption",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("key", models.CharField(max_length=64)),
                (
                    "value",
                    sentry.db.models.fields.encrypted.EncryptedPickledObjectField(editable=False),
                ),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Organization"),
                ),
            ],
            options={"db_table": "sentry_organizationoptions"},
        ),
        migrations.CreateModel(
            name="PlatformExternalIssue",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("group_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                ("service_type", models.CharField(max_length=64)),
                ("display_name", models.TextField()),
                ("web_url", models.URLField()),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_platformexternalissue"},
        ),
        migrations.CreateModel(
            name="ProcessingIssue",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("checksum", models.CharField(max_length=40, db_index=True)),
                ("type", models.CharField(max_length=30)),
                ("data", sentry.db.models.fields.gzippeddict.GzippedDictField()),
                ("datetime", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_processingissue"},
        ),
        migrations.CreateModel(
            name="Project",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("slug", models.SlugField(null=True)),
                ("name", models.CharField(max_length=200)),
                ("forced_color", models.CharField(max_length=6, null=True, blank=True)),
                ("public", models.BooleanField(default=False)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0,
                        db_index=True,
                        choices=[
                            (0, "Active"),
                            (2, "Pending Deletion"),
                            (3, "Deletion in Progress"),
                        ],
                    ),
                ),
                ("first_event", models.DateTimeField(null=True)),
                (
                    "flags",
                    bitfield.models.BitField(
                        (("has_releases", "This Project has sent release data"),),
                        default=0,
                        null=True,
                    ),
                ),
                ("platform", models.CharField(max_length=64, null=True)),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Organization"),
                ),
            ],
            options={"db_table": "sentry_project"},
            bases=(models.Model, sentry.db.mixin.PendingDeletionMixin),
        ),
        migrations.CreateModel(
            name="ProjectAvatar",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("ident", models.CharField(unique=True, max_length=32, db_index=True)),
                (
                    "avatar_type",
                    models.PositiveSmallIntegerField(
                        default=0, choices=[(0, "letter_avatar"), (1, "upload")]
                    ),
                ),
                (
                    "file",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="sentry.File",
                        unique=True,
                    ),
                ),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="avatar", to="sentry.Project", unique=True
                    ),
                ),
            ],
            options={"db_table": "sentry_projectavatar"},
        ),
        migrations.CreateModel(
            name="ProjectBookmark",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now, null=True)),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        db_constraint=False, blank=True, to="sentry.Project", null=True
                    ),
                ),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"db_table": "sentry_projectbookmark"},
        ),
        migrations.CreateModel(
            name="ProjectCfiCacheFile",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("checksum", models.CharField(max_length=40)),
                ("version", sentry.db.models.fields.bounded.BoundedPositiveIntegerField()),
                (
                    "cache_file",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.File"),
                ),
            ],
            options={"abstract": False, "db_table": "sentry_projectcficachefile"},
        ),
        migrations.CreateModel(
            name="ProjectDebugFile",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("object_name", models.TextField()),
                ("cpu_name", models.CharField(max_length=40)),
                ("debug_id", models.CharField(max_length=64, db_column="uuid")),
                ("code_id", models.CharField(max_length=64, null=True)),
                ("data", sentry.db.models.fields.jsonfield.JSONField(null=True)),
                ("file", sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.File")),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Project", null=True
                    ),
                ),
            ],
            options={"db_table": "sentry_projectdsymfile"},
        ),
        migrations.CreateModel(
            name="ProjectIntegration",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("config", sentry.db.models.fields.encrypted.EncryptedJsonField(default=dict)),
                (
                    "integration",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Integration"),
                ),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
                ),
            ],
            options={"db_table": "sentry_projectintegration"},
        ),
        migrations.CreateModel(
            name="ProjectKey",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("label", models.CharField(max_length=64, null=True, blank=True)),
                ("public_key", models.CharField(max_length=32, unique=True, null=True)),
                ("secret_key", models.CharField(max_length=32, unique=True, null=True)),
                (
                    "roles",
                    bitfield.models.BitField(
                        (("store", "Event API access"), ("api", "Web API access")), default=1
                    ),
                ),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0, db_index=True, choices=[(0, "Active"), (1, "Inactive")]
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now, null=True)),
                (
                    "rate_limit_count",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
                (
                    "rate_limit_window",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
                ("data", sentry.db.models.fields.jsonfield.JSONField(default=dict)),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="key_set", to="sentry.Project"
                    ),
                ),
            ],
            options={"db_table": "sentry_projectkey"},
        ),
        migrations.CreateModel(
            name="ProjectOption",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("key", models.CharField(max_length=64)),
                (
                    "value",
                    sentry.db.models.fields.encrypted.EncryptedPickledObjectField(editable=False),
                ),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
                ),
            ],
            options={"db_table": "sentry_projectoptions"},
        ),
        migrations.CreateModel(
            name="ProjectOwnership",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("raw", models.TextField(null=True)),
                ("schema", sentry.db.models.fields.jsonfield.JSONField(null=True)),
                ("fallthrough", models.BooleanField(default=True)),
                ("date_created", models.DateTimeField(default=django.utils.timezone.now)),
                ("last_updated", models.DateTimeField(default=django.utils.timezone.now)),
                ("is_active", models.BooleanField(default=True)),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Project", unique=True
                    ),
                ),
            ],
            options={"db_table": "sentry_projectownership"},
        ),
        migrations.CreateModel(
            name="ProjectPlatform",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("project_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                ("platform", models.CharField(max_length=64)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                ("last_seen", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "sentry_projectplatform"},
        ),
        migrations.CreateModel(
            name="ProjectRedirect",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("redirect_slug", models.SlugField()),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Organization"),
                ),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
                ),
            ],
            options={"db_table": "sentry_projectredirect"},
        ),
        migrations.CreateModel(
            name="ProjectSymCacheFile",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("checksum", models.CharField(max_length=40)),
                ("version", sentry.db.models.fields.bounded.BoundedPositiveIntegerField()),
                (
                    "cache_file",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.File"),
                ),
                (
                    "debug_file",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        db_column="dsym_file_id",
                        on_delete=django.db.models.deletion.DO_NOTHING,
                        to="sentry.ProjectDebugFile",
                    ),
                ),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Project", null=True
                    ),
                ),
            ],
            options={"abstract": False, "db_table": "sentry_projectsymcachefile"},
        ),
        migrations.CreateModel(
            name="ProjectTeam",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
                ),
            ],
            options={"db_table": "sentry_projectteam"},
        ),
        migrations.CreateModel(
            name="PromptsActivity",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "organization_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                ("feature", models.CharField(max_length=64)),
                ("data", sentry.db.models.fields.jsonfield.JSONField(default={})),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"db_table": "sentry_promptsactivity"},
        ),
        migrations.CreateModel(
            name="PullRequest",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "organization_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                ("repository_id", sentry.db.models.fields.bounded.BoundedPositiveIntegerField()),
                ("key", models.CharField(max_length=64)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                ("title", models.TextField(null=True)),
                ("message", models.TextField(null=True)),
                ("merge_commit_sha", models.CharField(max_length=64, null=True)),
                (
                    "author",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.CommitAuthor", null=True
                    ),
                ),
            ],
            options={"db_table": "sentry_pull_request"},
        ),
        migrations.CreateModel(
            name="PullRequestCommit",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "commit",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Commit"),
                ),
                (
                    "pull_request",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.PullRequest"),
                ),
            ],
            options={"db_table": "sentry_pullrequest_commit"},
        ),
        migrations.CreateModel(
            name="RawEvent",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("event_id", models.CharField(max_length=32, null=True)),
                ("datetime", models.DateTimeField(default=django.utils.timezone.now)),
                ("data", sentry.db.models.fields.node.NodeField(null=True, blank=True)),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
                ),
            ],
            options={"db_table": "sentry_rawevent"},
        ),
        migrations.CreateModel(
            name="RecentSearch",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("type", models.PositiveSmallIntegerField()),
                ("query", models.TextField()),
                ("query_hash", models.CharField(max_length=32)),
                ("last_seen", models.DateTimeField(default=django.utils.timezone.now)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Organization"),
                ),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL, db_index=False
                    ),
                ),
            ],
            options={"db_table": "sentry_recentsearch"},
        ),
        migrations.CreateModel(
            name="Relay",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("relay_id", models.CharField(unique=True, max_length=64)),
                ("public_key", models.CharField(max_length=200)),
                ("first_seen", models.DateTimeField(default=django.utils.timezone.now)),
                ("last_seen", models.DateTimeField(default=django.utils.timezone.now)),
                ("is_internal", models.BooleanField(default=False)),
            ],
            options={"db_table": "sentry_relay"},
        ),
        migrations.CreateModel(
            name="Release",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("project_id", sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True)),
                ("version", models.CharField(max_length=250)),
                ("ref", models.CharField(max_length=250, null=True, blank=True)),
                ("url", models.URLField(null=True, blank=True)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                ("date_started", models.DateTimeField(null=True, blank=True)),
                ("date_released", models.DateTimeField(null=True, blank=True)),
                ("data", sentry.db.models.fields.jsonfield.JSONField(default={})),
                (
                    "new_groups",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(default=0),
                ),
                (
                    "commit_count",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0, null=True
                    ),
                ),
                (
                    "last_commit_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
                ("authors", sentry.db.models.fields.array.ArrayField(null=True)),
                (
                    "total_deploys",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0, null=True
                    ),
                ),
                (
                    "last_deploy_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Organization"),
                ),
                (
                    "owner",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        on_delete=django.db.models.deletion.SET_NULL,
                        blank=True,
                        to=settings.AUTH_USER_MODEL,
                        null=True,
                    ),
                ),
            ],
            options={"db_table": "sentry_release"},
        ),
        migrations.CreateModel(
            name="ReleaseCommit",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "organization_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
                ("order", sentry.db.models.fields.bounded.BoundedPositiveIntegerField()),
                (
                    "commit",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Commit"),
                ),
                (
                    "release",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Release"),
                ),
            ],
            options={"db_table": "sentry_releasecommit"},
        ),
        migrations.CreateModel(
            name="ReleaseEnvironment",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
                ("first_seen", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "last_seen",
                    models.DateTimeField(default=django.utils.timezone.now, db_index=True),
                ),
                (
                    "environment",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Environment", db_constraint=False
                    ),
                ),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Organization", db_constraint=False
                    ),
                ),
                (
                    "release",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Release", db_constraint=False
                    ),
                ),
            ],
            options={"db_table": "sentry_environmentrelease"},
        ),
        migrations.CreateModel(
            name="ReleaseFile",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("project_id", sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True)),
                ("ident", models.CharField(max_length=40)),
                ("name", models.TextField()),
                (
                    "dist",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Distribution", null=True
                    ),
                ),
                ("file", sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.File")),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Organization"),
                ),
                (
                    "release",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Release"),
                ),
            ],
            options={"db_table": "sentry_releasefile"},
        ),
        migrations.CreateModel(
            name="ReleaseHeadCommit",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "organization_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                ("repository_id", sentry.db.models.fields.bounded.BoundedPositiveIntegerField()),
                (
                    "commit",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Commit"),
                ),
                (
                    "release",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Release"),
                ),
            ],
            options={"db_table": "sentry_releaseheadcommit"},
        ),
        migrations.CreateModel(
            name="ReleaseProject",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "new_groups",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0, null=True
                    ),
                ),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
                ),
                (
                    "release",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Release"),
                ),
            ],
            options={"db_table": "sentry_release_project"},
        ),
        migrations.CreateModel(
            name="ReleaseProjectEnvironment",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "new_issues_count",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(default=0),
                ),
                ("first_seen", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "last_seen",
                    models.DateTimeField(default=django.utils.timezone.now, db_index=True),
                ),
                (
                    "last_deploy_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        null=True, db_index=True
                    ),
                ),
                (
                    "environment",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Environment"),
                ),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
                ),
                (
                    "release",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Release"),
                ),
            ],
            options={"db_table": "sentry_releaseprojectenvironment"},
        ),
        migrations.CreateModel(
            name="Repository",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "organization_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                ("name", models.CharField(max_length=200)),
                ("url", models.URLField(null=True)),
                ("provider", models.CharField(max_length=64, null=True)),
                ("external_id", models.CharField(max_length=64, null=True)),
                ("config", sentry.db.models.fields.jsonfield.JSONField(default=dict)),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0,
                        db_index=True,
                        choices=[
                            (0, "active"),
                            (1, "disabled"),
                            (2, "pending_deletion"),
                            (3, "deletion_in_progress"),
                        ],
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "integration_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        null=True, db_index=True
                    ),
                ),
            ],
            options={"db_table": "sentry_repository"},
            bases=(models.Model, sentry.db.mixin.PendingDeletionMixin),
        ),
        migrations.CreateModel(
            name="ReprocessingReport",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("event_id", models.CharField(max_length=32, null=True)),
                ("datetime", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
                ),
            ],
            options={"db_table": "sentry_reprocessingreport"},
        ),
        migrations.CreateModel(
            name="Rule",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "environment_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(null=True),
                ),
                ("label", models.CharField(max_length=64)),
                ("data", sentry.db.models.fields.gzippeddict.GzippedDictField()),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0, db_index=True, choices=[(0, "Active"), (1, "Inactive")]
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
                ),
            ],
            options={"db_table": "sentry_rule"},
        ),
        migrations.CreateModel(
            name="SavedSearch",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("type", models.PositiveSmallIntegerField(default=0, null=True)),
                ("name", models.CharField(max_length=128)),
                ("query", models.TextField()),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                ("is_default", models.BooleanField(default=False)),
                ("is_global", models.NullBooleanField(default=False, db_index=True)),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Organization", null=True
                    ),
                ),
                (
                    "owner",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL, null=True
                    ),
                ),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Project", null=True
                    ),
                ),
            ],
            options={"db_table": "sentry_savedsearch"},
        ),
        migrations.CreateModel(
            name="SavedSearchUserDefault",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
                ),
                (
                    "savedsearch",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.SavedSearch"),
                ),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"db_table": "sentry_savedsearch_userdefault"},
        ),
        migrations.CreateModel(
            name="ScheduledDeletion",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "guid",
                    models.CharField(
                        default=sentry.models.scheduledeletion.default_guid,
                        unique=True,
                        max_length=32,
                    ),
                ),
                ("app_label", models.CharField(max_length=64)),
                ("model_name", models.CharField(max_length=64)),
                ("object_id", sentry.db.models.fields.bounded.BoundedBigIntegerField()),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "date_scheduled",
                    models.DateTimeField(
                        default=sentry.models.scheduledeletion.default_date_schedule
                    ),
                ),
                ("actor_id", sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True)),
                ("data", sentry.db.models.fields.jsonfield.JSONField(default={})),
                ("in_progress", models.BooleanField(default=False)),
                ("aborted", models.BooleanField(default=False)),
            ],
            options={"db_table": "sentry_scheduleddeletion"},
        ),
        migrations.CreateModel(
            name="ScheduledJob",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("name", models.CharField(max_length=128)),
                ("payload", sentry.db.models.fields.jsonfield.JSONField(default=dict)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                ("date_scheduled", models.DateTimeField()),
            ],
            options={"db_table": "sentry_scheduledjob"},
        ),
        migrations.CreateModel(
            name="SentryApp",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("date_deleted", models.DateTimeField(null=True, blank=True)),
                (
                    "scopes",
                    bitfield.models.BitField(
                        (
                            ("project:read", "project:read"),
                            ("project:write", "project:write"),
                            ("project:admin", "project:admin"),
                            ("project:releases", "project:releases"),
                            ("team:read", "team:read"),
                            ("team:write", "team:write"),
                            ("team:admin", "team:admin"),
                            ("event:read", "event:read"),
                            ("event:write", "event:write"),
                            ("event:admin", "event:admin"),
                            ("org:read", "org:read"),
                            ("org:write", "org:write"),
                            ("org:admin", "org:admin"),
                            ("member:read", "member:read"),
                            ("member:write", "member:write"),
                            ("member:admin", "member:admin"),
                        ),
                        default=None,
                    ),
                ),
                ("scope_list", sentry.db.models.fields.array.ArrayField(null=True)),
                ("name", models.TextField()),
                ("slug", models.CharField(unique=True, max_length=64)),
                ("author", models.TextField(null=True)),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0, db_index=True, choices=[(0, "unpublished"), (1, "published")]
                    ),
                ),
                (
                    "uuid",
                    models.CharField(default=sentry.models.sentryapp.default_uuid, max_length=64),
                ),
                ("redirect_url", models.URLField(null=True)),
                ("webhook_url", models.URLField()),
                ("is_alertable", models.BooleanField(default=False)),
                ("events", sentry.db.models.fields.array.ArrayField(null=True)),
                ("overview", models.TextField(null=True)),
                ("schema", sentry.db.models.fields.encrypted.EncryptedJsonField(default=dict)),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                ("date_updated", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "application",
                    models.OneToOneField(
                        related_name="sentry_app",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="sentry.ApiApplication",
                    ),
                ),
                (
                    "owner",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="owned_sentry_apps", to="sentry.Organization"
                    ),
                ),
                (
                    "proxy_user",
                    models.OneToOneField(
                        related_name="sentry_app",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "sentry_sentryapp"},
        ),
        migrations.CreateModel(
            name="SentryAppAvatar",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("ident", models.CharField(unique=True, max_length=32, db_index=True)),
                (
                    "avatar_type",
                    models.PositiveSmallIntegerField(
                        default=0, choices=[(0, "letter_avatar"), (1, "upload")]
                    ),
                ),
                (
                    "file",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="sentry.File",
                        unique=True,
                    ),
                ),
                (
                    "sentry_app",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="avatar", to="sentry.SentryApp", unique=True
                    ),
                ),
            ],
            options={"db_table": "sentry_sentryappavatar"},
        ),
        migrations.CreateModel(
            name="SentryAppComponent",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "uuid",
                    sentry.db.models.fields.uuid.UUIDField(
                        unique=True, max_length=32, editable=False
                    ),
                ),
                ("type", models.CharField(max_length=64)),
                ("schema", sentry.db.models.fields.encrypted.EncryptedJsonField(default=dict)),
                (
                    "sentry_app",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="components", to="sentry.SentryApp"
                    ),
                ),
            ],
            options={"db_table": "sentry_sentryappcomponent"},
        ),
        migrations.CreateModel(
            name="SentryAppInstallation",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("date_deleted", models.DateTimeField(null=True, blank=True)),
                (
                    "uuid",
                    models.CharField(
                        default=sentry.models.sentryappinstallation.default_uuid, max_length=64
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                ("date_updated", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "api_grant",
                    models.OneToOneField(
                        related_name="sentry_app_installation",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="sentry.ApiGrant",
                    ),
                ),
                (
                    "authorization",
                    models.OneToOneField(
                        related_name="sentry_app_installation",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="sentry.ApiAuthorization",
                    ),
                ),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="sentry_app_installations", to="sentry.Organization"
                    ),
                ),
                (
                    "sentry_app",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="installations", to="sentry.SentryApp"
                    ),
                ),
            ],
            options={"db_table": "sentry_sentryappinstallation"},
        ),
        migrations.CreateModel(
            name="ServiceHook",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("guid", models.CharField(max_length=32, unique=True, null=True)),
                (
                    "actor_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                (
                    "organization_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        null=True, db_index=True
                    ),
                ),
                ("url", models.URLField(max_length=512)),
                (
                    "secret",
                    sentry.db.models.fields.encrypted.EncryptedTextField(
                        default=sentry.models.servicehook.generate_secret
                    ),
                ),
                ("events", sentry.db.models.fields.array.ArrayField(null=True)),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0,
                        db_index=True,
                        choices=[
                            (0, "active"),
                            (1, "disabled"),
                            (2, "pending_deletion"),
                            (3, "deletion_in_progress"),
                        ],
                    ),
                ),
                (
                    "version",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0, choices=[(0, "0")]
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "application",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.ApiApplication", null=True
                    ),
                ),
            ],
            options={"db_table": "sentry_servicehook"},
        ),
        migrations.CreateModel(
            name="ServiceHookProject",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(db_index=True),
                ),
                (
                    "service_hook",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.ServiceHook"),
                ),
            ],
            options={"db_table": "sentry_servicehookproject"},
        ),
        migrations.CreateModel(
            name="TagKey",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedBigIntegerField(db_index=True),
                ),
                ("key", models.CharField(max_length=32)),
                (
                    "values_seen",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(default=0),
                ),
                ("label", models.CharField(max_length=64, null=True)),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0,
                        choices=[
                            (0, "Visible"),
                            (1, "Pending Deletion"),
                            (2, "Deletion in Progress"),
                        ],
                    ),
                ),
            ],
            options={"db_table": "sentry_filterkey"},
        ),
        migrations.CreateModel(
            name="TagValue",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "project_id",
                    sentry.db.models.fields.bounded.BoundedBigIntegerField(
                        null=True, db_index=True
                    ),
                ),
                ("key", models.CharField(max_length=32)),
                ("value", models.CharField(max_length=200)),
                (
                    "data",
                    sentry.db.models.fields.gzippeddict.GzippedDictField(null=True, blank=True),
                ),
                (
                    "times_seen",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(default=0),
                ),
                (
                    "last_seen",
                    models.DateTimeField(
                        default=django.utils.timezone.now, null=True, db_index=True
                    ),
                ),
                (
                    "first_seen",
                    models.DateTimeField(
                        default=django.utils.timezone.now, null=True, db_index=True
                    ),
                ),
            ],
            options={"db_table": "sentry_filtervalue"},
        ),
        migrations.CreateModel(
            name="Team",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("slug", models.SlugField()),
                ("name", models.CharField(max_length=64)),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0,
                        choices=[
                            (0, "Active"),
                            (1, "Pending Deletion"),
                            (2, "Deletion in Progress"),
                        ],
                    ),
                ),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now, null=True)),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Organization"),
                ),
            ],
            options={"db_table": "sentry_team"},
        ),
        migrations.CreateModel(
            name="TeamAvatar",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("ident", models.CharField(unique=True, max_length=32, db_index=True)),
                (
                    "avatar_type",
                    models.PositiveSmallIntegerField(
                        default=0, choices=[(0, "letter_avatar"), (1, "upload")]
                    ),
                ),
                (
                    "file",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="sentry.File",
                        unique=True,
                    ),
                ),
                (
                    "team",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="avatar", to="sentry.Team", unique=True
                    ),
                ),
            ],
            options={"db_table": "sentry_teamavatar"},
        ),
        migrations.CreateModel(
            name="UserAvatar",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("ident", models.CharField(unique=True, max_length=32, db_index=True)),
                (
                    "avatar_type",
                    models.PositiveSmallIntegerField(
                        default=0, choices=[(0, "letter_avatar"), (1, "upload"), (2, "gravatar")]
                    ),
                ),
                (
                    "file",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="sentry.File",
                        unique=True,
                    ),
                ),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="avatar", to=settings.AUTH_USER_MODEL, unique=True
                    ),
                ),
            ],
            options={"db_table": "sentry_useravatar"},
        ),
        migrations.CreateModel(
            name="UserEmail",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("email", models.EmailField(max_length=75, verbose_name="email address")),
                (
                    "validation_hash",
                    models.CharField(
                        default=sentry.models.useremail.default_validation_hash, max_length=32
                    ),
                ),
                ("date_hash_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "is_verified",
                    models.BooleanField(
                        default=False,
                        help_text="Designates whether this user has confirmed their email.",
                        verbose_name="verified",
                    ),
                ),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        related_name="emails", to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"db_table": "sentry_useremail"},
        ),
        migrations.CreateModel(
            name="UserIP",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("ip_address", models.GenericIPAddressField()),
                ("country_code", models.CharField(max_length=16, null=True)),
                ("region_code", models.CharField(max_length=16, null=True)),
                ("first_seen", models.DateTimeField(default=django.utils.timezone.now)),
                ("last_seen", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"db_table": "sentry_userip"},
        ),
        migrations.CreateModel(
            name="UserOption",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("key", models.CharField(max_length=64)),
                (
                    "value",
                    sentry.db.models.fields.encrypted.EncryptedPickledObjectField(editable=False),
                ),
                (
                    "organization",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Organization", null=True
                    ),
                ),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Project", null=True
                    ),
                ),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"db_table": "sentry_useroption"},
        ),
        migrations.CreateModel(
            name="UserPermission",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("permission", models.CharField(max_length=32)),
                (
                    "user",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"db_table": "sentry_userpermission"},
        ),
        migrations.CreateModel(
            name="UserReport",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "event_user_id",
                    sentry.db.models.fields.bounded.BoundedBigIntegerField(null=True),
                ),
                ("event_id", models.CharField(max_length=32)),
                ("name", models.CharField(max_length=128)),
                ("email", models.EmailField(max_length=75)),
                ("comments", models.TextField()),
                (
                    "date_added",
                    models.DateTimeField(default=django.utils.timezone.now, db_index=True),
                ),
                (
                    "environment",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Environment", null=True
                    ),
                ),
                (
                    "group",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                        to="sentry.Group", null=True
                    ),
                ),
                (
                    "project",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
                ),
            ],
            options={"db_table": "sentry_userreport"},
        ),
        migrations.CreateModel(
            name="Widget",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                ("order", sentry.db.models.fields.bounded.BoundedPositiveIntegerField()),
                ("title", models.CharField(max_length=255)),
                (
                    "display_type",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        choices=[
                            (0, "line"),
                            (1, "area"),
                            (2, "stacked_area"),
                            (3, "bar"),
                            (4, "pie"),
                            (5, "table"),
                            (6, "world_map"),
                            (7, "percentage_area_chart"),
                        ]
                    ),
                ),
                ("display_options", sentry.db.models.fields.jsonfield.JSONField(default={})),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0,
                        choices=[
                            (0, "active"),
                            (1, "disabled"),
                            (2, "pending_deletion"),
                            (3, "deletion_in_progress"),
                        ],
                    ),
                ),
                (
                    "dashboard",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Dashboard"),
                ),
            ],
            options={"db_table": "sentry_widget"},
        ),
        migrations.CreateModel(
            name="WidgetDataSource",
            fields=[
                (
                    "id",
                    sentry.db.models.fields.bounded.BoundedBigAutoField(
                        serialize=False, primary_key=True
                    ),
                ),
                (
                    "type",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        choices=[(0, "discover_saved_search")]
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                ("data", sentry.db.models.fields.jsonfield.JSONField(default={})),
                ("order", sentry.db.models.fields.bounded.BoundedPositiveIntegerField()),
                ("date_added", models.DateTimeField(default=django.utils.timezone.now)),
                (
                    "status",
                    sentry.db.models.fields.bounded.BoundedPositiveIntegerField(
                        default=0,
                        choices=[
                            (0, "active"),
                            (1, "disabled"),
                            (2, "pending_deletion"),
                            (3, "deletion_in_progress"),
                        ],
                    ),
                ),
                (
                    "widget",
                    sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Widget"),
                ),
            ],
            options={"db_table": "sentry_widgetdatasource"},
        ),
        migrations.AlterUniqueTogether(
            name="tagvalue", unique_together={("project_id", "key", "value")}
        ),
        migrations.AlterIndexTogether(
            name="tagvalue", index_together={("project_id", "key", "last_seen")}
        ),
        migrations.AlterUniqueTogether(name="tagkey", unique_together={("project_id", "key")}),
        migrations.AlterUniqueTogether(
            name="scheduleddeletion",
            unique_together={("app_label", "model_name", "object_id")},
        ),
        migrations.AlterUniqueTogether(
            name="repository",
            unique_together={
                ("organization_id", "provider", "external_id"),
                ("organization_id", "name"),
            },
        ),
        migrations.AddField(
            model_name="release",
            name="projects",
            field=models.ManyToManyField(
                related_name="releases", through="sentry.ReleaseProject", to="sentry.Project"
            ),
        ),
        migrations.AddField(
            model_name="projectteam",
            name="team",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Team"),
        ),
        migrations.AlterUniqueTogether(
            name="projectplatform", unique_together={("project_id", "platform")}
        ),
        migrations.AddField(
            model_name="projectcficachefile",
            name="debug_file",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                db_column="dsym_file_id",
                on_delete=django.db.models.deletion.DO_NOTHING,
                to="sentry.ProjectDebugFile",
            ),
        ),
        migrations.AddField(
            model_name="projectcficachefile",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.Project", null=True
            ),
        ),
        migrations.AddField(
            model_name="project",
            name="teams",
            field=models.ManyToManyField(
                related_name="teams", through="sentry.ProjectTeam", to="sentry.Team"
            ),
        ),
        migrations.AddField(
            model_name="processingissue",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
        ),
        migrations.AlterUniqueTogether(
            name="platformexternalissue", unique_together={("group_id", "service_type")}
        ),
        migrations.AddField(
            model_name="organizationmemberteam",
            name="team",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Team"),
        ),
        migrations.AddField(
            model_name="organizationmember",
            name="teams",
            field=models.ManyToManyField(
                to="sentry.Team", through="sentry.OrganizationMemberTeam", blank=True
            ),
        ),
        migrations.AddField(
            model_name="organizationmember",
            name="user",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                related_name="sentry_orgmember_set",
                blank=True,
                to=settings.AUTH_USER_MODEL,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="organizationaccessrequest",
            name="member",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.OrganizationMember"
            ),
        ),
        migrations.AddField(
            model_name="organizationaccessrequest",
            name="team",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Team"),
        ),
        migrations.AddField(
            model_name="organization",
            name="members",
            field=models.ManyToManyField(
                related_name="org_memberships",
                through="sentry.OrganizationMember",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="monitorcheckin",
            name="location",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.MonitorLocation", null=True
            ),
        ),
        migrations.AddField(
            model_name="monitorcheckin",
            name="monitor",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Monitor"),
        ),
        migrations.AlterIndexTogether(name="monitor", index_together={("type", "next_checkin")}),
        migrations.AlterUniqueTogether(
            name="latestrelease", unique_together={("repository_id", "environment_id")}
        ),
        migrations.AlterUniqueTogether(
            name="integrationexternalproject",
            unique_together={("organization_integration_id", "external_id")},
        ),
        migrations.AddField(
            model_name="integration",
            name="organizations",
            field=models.ManyToManyField(
                related_name="integrations",
                through="sentry.OrganizationIntegration",
                to="sentry.Organization",
            ),
        ),
        migrations.AddField(
            model_name="integration",
            name="projects",
            field=models.ManyToManyField(
                related_name="integrations",
                through="sentry.ProjectIntegration",
                to="sentry.Project",
            ),
        ),
        migrations.AlterUniqueTogether(
            name="identityprovider", unique_together={("type", "external_id")}
        ),
        migrations.AddField(
            model_name="identity",
            name="idp",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.IdentityProvider"
            ),
        ),
        migrations.AddField(
            model_name="identity",
            name="user",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to=settings.AUTH_USER_MODEL
            ),
        ),
        migrations.AddField(
            model_name="grouptombstone",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
        ),
        migrations.AlterUniqueTogether(
            name="grouptagvalue", unique_together={("group_id", "key", "value")}
        ),
        migrations.AlterIndexTogether(
            name="grouptagvalue", index_together={("project_id", "key", "value", "last_seen")}
        ),
        migrations.AlterUniqueTogether(
            name="grouptagkey", unique_together={("project_id", "group_id", "key")}
        ),
        migrations.AddField(
            model_name="groupsubscription",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                related_name="subscription_set", to="sentry.Project"
            ),
        ),
        migrations.AddField(
            model_name="groupsubscription",
            name="user",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to=settings.AUTH_USER_MODEL
            ),
        ),
        migrations.AddField(
            model_name="groupshare",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
        ),
        migrations.AddField(
            model_name="groupshare",
            name="user",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to=settings.AUTH_USER_MODEL, null=True
            ),
        ),
        migrations.AddField(
            model_name="groupseen",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
        ),
        migrations.AddField(
            model_name="groupseen",
            name="user",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to=settings.AUTH_USER_MODEL, db_index=False
            ),
        ),
        migrations.AddField(
            model_name="grouprulestatus",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
        ),
        migrations.AddField(
            model_name="grouprulestatus",
            name="rule",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Rule"),
        ),
        migrations.AddField(
            model_name="groupresolution",
            name="release",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Release"),
        ),
        migrations.AlterUniqueTogether(
            name="grouprelease", unique_together={("group_id", "release_id", "environment")}
        ),
        migrations.AlterUniqueTogether(
            name="grouplink", unique_together={("group_id", "linked_type", "linked_id")}
        ),
        migrations.AddField(
            model_name="grouphash",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.Project", null=True
            ),
        ),
        migrations.AddField(
            model_name="groupenvironment",
            name="first_release",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                db_constraint=False,
                on_delete=django.db.models.deletion.DO_NOTHING,
                to="sentry.Release",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="groupenvironment",
            name="group",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.Group", db_constraint=False
            ),
        ),
        migrations.AddField(
            model_name="groupemailthread",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                related_name="groupemail_set", to="sentry.Project"
            ),
        ),
        migrations.AlterUniqueTogether(
            name="groupcommitresolution", unique_together={("group_id", "commit_id")}
        ),
        migrations.AddField(
            model_name="groupbookmark",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                related_name="bookmark_set", to="sentry.Project"
            ),
        ),
        migrations.AddField(
            model_name="groupbookmark",
            name="user",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                related_name="sentry_bookmark_set", to=settings.AUTH_USER_MODEL
            ),
        ),
        migrations.AddField(
            model_name="groupassignee",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                related_name="assignee_set", to="sentry.Project"
            ),
        ),
        migrations.AddField(
            model_name="groupassignee",
            name="team",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                related_name="sentry_assignee_set", to="sentry.Team", null=True
            ),
        ),
        migrations.AddField(
            model_name="groupassignee",
            name="user",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                related_name="sentry_assignee_set", to=settings.AUTH_USER_MODEL, null=True
            ),
        ),
        migrations.AddField(
            model_name="group",
            name="first_release",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                on_delete=django.db.models.deletion.PROTECT, to="sentry.Release", null=True
            ),
        ),
        migrations.AddField(
            model_name="group",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.Project", null=True
            ),
        ),
        migrations.AddField(
            model_name="fileblobowner",
            name="organization",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Organization"),
        ),
        migrations.AddField(
            model_name="file",
            name="blob",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                related_name="legacy_blob", to="sentry.FileBlob", null=True
            ),
        ),
        migrations.AddField(
            model_name="file",
            name="blobs",
            field=models.ManyToManyField(to="sentry.FileBlob", through="sentry.FileBlobIndex"),
        ),
        migrations.AddField(
            model_name="featureadoption",
            name="organization",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Organization"),
        ),
        migrations.AlterUniqueTogether(
            name="externalissue",
            unique_together={("organization_id", "integration_id", "key")},
        ),
        migrations.AlterUniqueTogether(
            name="eventuser", unique_together={("project_id", "hash"), ("project_id", "ident")}
        ),
        migrations.AlterIndexTogether(
            name="eventuser",
            index_together={
                ("project_id", "username"),
                ("project_id", "ip_address"),
                ("project_id", "email"),
            },
        ),
        migrations.AlterUniqueTogether(
            name="eventtag", unique_together={("event_id", "key_id", "value_id")}
        ),
        migrations.AlterIndexTogether(
            name="eventtag", index_together={("group_id", "key_id", "value_id")}
        ),
        migrations.AddField(
            model_name="eventprocessingissue",
            name="processing_issue",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.ProcessingIssue"
            ),
        ),
        migrations.AddField(
            model_name="eventprocessingissue",
            name="raw_event",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.RawEvent"),
        ),
        migrations.AlterUniqueTogether(
            name="eventmapping", unique_together={("project_id", "event_id")}
        ),
        migrations.AddField(
            model_name="eventattachment",
            name="file",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.File"),
        ),
        migrations.AlterUniqueTogether(name="event", unique_together={("project_id", "event_id")}),
        migrations.AlterIndexTogether(name="event", index_together={("group_id", "datetime")}),
        migrations.AddField(
            model_name="environmentproject",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
        ),
        migrations.AddField(
            model_name="environment",
            name="projects",
            field=models.ManyToManyField(to="sentry.Project", through="sentry.EnvironmentProject"),
        ),
        migrations.AddField(
            model_name="distribution",
            name="release",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Release"),
        ),
        migrations.AddField(
            model_name="discoversavedqueryproject",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
        ),
        migrations.AddField(
            model_name="discoversavedquery",
            name="organization",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Organization"),
        ),
        migrations.AddField(
            model_name="discoversavedquery",
            name="projects",
            field=models.ManyToManyField(
                to="sentry.Project", through="sentry.DiscoverSavedQueryProject"
            ),
        ),
        migrations.AddField(
            model_name="deploy",
            name="release",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Release"),
        ),
        migrations.AddField(
            model_name="dashboard",
            name="organization",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Organization"),
        ),
        migrations.AddField(
            model_name="counter",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.Project", unique=True
            ),
        ),
        migrations.AlterUniqueTogether(
            name="commitauthor",
            unique_together={("organization_id", "email"), ("organization_id", "external_id")},
        ),
        migrations.AddField(
            model_name="commit",
            name="author",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.CommitAuthor", null=True
            ),
        ),
        migrations.AddField(
            model_name="authprovider",
            name="default_teams",
            field=models.ManyToManyField(to="sentry.Team", blank=True),
        ),
        migrations.AddField(
            model_name="authprovider",
            name="organization",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.Organization", unique=True
            ),
        ),
        migrations.AddField(
            model_name="authidentity",
            name="auth_provider",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.AuthProvider"),
        ),
        migrations.AddField(
            model_name="authidentity",
            name="user",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to=settings.AUTH_USER_MODEL
            ),
        ),
        migrations.AddField(
            model_name="auditlogentry",
            name="organization",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Organization"),
        ),
        migrations.AddField(
            model_name="auditlogentry",
            name="target_user",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                related_name="audit_targets", blank=True, to=settings.AUTH_USER_MODEL, null=True
            ),
        ),
        migrations.AddField(
            model_name="apikey",
            name="organization",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                related_name="key_set", to="sentry.Organization"
            ),
        ),
        migrations.AddField(
            model_name="activity",
            name="group",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to="sentry.Group", null=True
            ),
        ),
        migrations.AddField(
            model_name="activity",
            name="project",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(to="sentry.Project"),
        ),
        migrations.AddField(
            model_name="activity",
            name="user",
            field=sentry.db.models.fields.foreignkey.FlexibleForeignKey(
                to=settings.AUTH_USER_MODEL, null=True
            ),
        ),
        migrations.AlterUniqueTogether(
            name="widgetdatasource", unique_together={("widget", "name"), ("widget", "order")}
        ),
        migrations.AlterUniqueTogether(
            name="widget", unique_together={("dashboard", "title"), ("dashboard", "order")}
        ),
        migrations.AlterUniqueTogether(
            name="userreport", unique_together={("project", "event_id")}
        ),
        migrations.AlterIndexTogether(
            name="userreport",
            index_together={("project", "date_added"), ("project", "event_id")},
        ),
        migrations.AlterUniqueTogether(
            name="userpermission", unique_together={("user", "permission")}
        ),
        migrations.AlterUniqueTogether(
            name="useroption",
            unique_together={("user", "project", "key"), ("user", "organization", "key")},
        ),
        migrations.AlterUniqueTogether(name="userip", unique_together={("user", "ip_address")}),
        migrations.AlterUniqueTogether(name="useremail", unique_together={("user", "email")}),
        migrations.AlterUniqueTogether(name="team", unique_together={("organization", "slug")}),
        migrations.AlterUniqueTogether(
            name="servicehookproject", unique_together={("service_hook", "project_id")}
        ),
        migrations.AlterUniqueTogether(
            name="savedsearchuserdefault", unique_together={("project", "user")}
        ),
        migrations.AlterUniqueTogether(
            name="savedsearch",
            unique_together={("organization", "owner", "type"), ("project", "name")},
        ),
        migrations.AlterUniqueTogether(
            name="reprocessingreport", unique_together={("project", "event_id")}
        ),
        migrations.AlterUniqueTogether(
            name="releaseprojectenvironment",
            unique_together={("project", "release", "environment")},
        ),
        migrations.AlterUniqueTogether(
            name="releaseproject", unique_together={("project", "release")}
        ),
        migrations.AlterUniqueTogether(
            name="releaseheadcommit", unique_together={("repository_id", "release")}
        ),
        migrations.AlterUniqueTogether(name="releasefile", unique_together={("release", "ident")}),
        migrations.AlterIndexTogether(name="releasefile", index_together={("release", "name")}),
        migrations.AlterUniqueTogether(
            name="releaseenvironment",
            unique_together={("organization", "release", "environment")},
        ),
        migrations.AlterUniqueTogether(
            name="releasecommit", unique_together={("release", "commit"), ("release", "order")}
        ),
        migrations.AlterUniqueTogether(
            name="release", unique_together={("organization", "version")}
        ),
        migrations.AlterUniqueTogether(
            name="recentsearch",
            unique_together={("user", "organization", "type", "query_hash")},
        ),
        migrations.AlterUniqueTogether(name="rawevent", unique_together={("project", "event_id")}),
        migrations.AlterUniqueTogether(
            name="pullrequestcommit", unique_together={("pull_request", "commit")}
        ),
        migrations.AlterUniqueTogether(
            name="pullrequest", unique_together={("repository_id", "key")}
        ),
        migrations.AlterIndexTogether(
            name="pullrequest",
            index_together={
                ("repository_id", "date_added"),
                ("organization_id", "merge_commit_sha"),
            },
        ),
        migrations.AlterUniqueTogether(
            name="promptsactivity",
            unique_together={("user", "feature", "organization_id", "project_id")},
        ),
        migrations.AlterUniqueTogether(name="projectteam", unique_together={("project", "team")}),
        migrations.AlterUniqueTogether(
            name="projectsymcachefile", unique_together={("project", "debug_file")}
        ),
        migrations.AlterUniqueTogether(
            name="projectredirect", unique_together={("organization", "redirect_slug")}
        ),
        migrations.AlterUniqueTogether(name="projectoption", unique_together={("project", "key")}),
        migrations.AlterUniqueTogether(
            name="projectintegration", unique_together={("project", "integration")}
        ),
        migrations.AlterIndexTogether(
            name="projectdebugfile",
            index_together={("project", "code_id"), ("project", "debug_id")},
        ),
        migrations.AlterUniqueTogether(
            name="projectcficachefile", unique_together={("project", "debug_file")}
        ),
        migrations.AlterUniqueTogether(
            name="projectbookmark", unique_together={("project", "user")}
        ),
        migrations.AlterUniqueTogether(name="project", unique_together={("organization", "slug")}),
        migrations.AlterUniqueTogether(
            name="processingissue", unique_together={("project", "checksum", "type")}
        ),
        migrations.AlterUniqueTogether(
            name="organizationoption", unique_together={("organization", "key")}
        ),
        migrations.AlterUniqueTogether(
            name="organizationonboardingtask", unique_together={("organization", "task")}
        ),
        migrations.AlterUniqueTogether(
            name="organizationmemberteam", unique_together={("team", "organizationmember")}
        ),
        migrations.AlterUniqueTogether(
            name="organizationmember",
            unique_together={("organization", "user"), ("organization", "email")},
        ),
        migrations.AlterUniqueTogether(
            name="organizationintegration", unique_together={("organization", "integration")}
        ),
        migrations.AlterUniqueTogether(
            name="organizationaccessrequest", unique_together={("team", "member")}
        ),
        migrations.AlterUniqueTogether(
            name="integration", unique_together={("provider", "external_id")}
        ),
        migrations.AlterUniqueTogether(
            name="identity", unique_together={("idp", "external_id"), ("idp", "user")}
        ),
        migrations.AlterUniqueTogether(
            name="groupsubscription", unique_together={("group", "user")}
        ),
        migrations.AlterUniqueTogether(name="groupseen", unique_together={("user", "group")}),
        migrations.AlterUniqueTogether(name="grouprulestatus", unique_together={("rule", "group")}),
        migrations.AlterUniqueTogether(name="groupmeta", unique_together={("group", "key")}),
        migrations.AlterUniqueTogether(name="grouphash", unique_together={("project", "hash")}),
        migrations.AlterUniqueTogether(
            name="groupenvironment", unique_together={("group", "environment")}
        ),
        migrations.AlterIndexTogether(
            name="groupenvironment", index_together={("environment", "first_release")}
        ),
        migrations.AlterUniqueTogether(
            name="groupemailthread", unique_together={("email", "msgid"), ("email", "group")}
        ),
        migrations.AlterUniqueTogether(
            name="groupbookmark", unique_together={("project", "user", "group")}
        ),
        migrations.AlterUniqueTogether(name="group", unique_together={("project", "short_id")}),
        migrations.AlterIndexTogether(name="group", index_together={("project", "first_release")}),
        migrations.AlterUniqueTogether(
            name="fileblobowner", unique_together={("blob", "organization")}
        ),
        migrations.AlterUniqueTogether(
            name="fileblobindex", unique_together={("file", "blob", "offset")}
        ),
        migrations.AlterUniqueTogether(
            name="featureadoption", unique_together={("organization", "feature_id")}
        ),
        migrations.AlterUniqueTogether(
            name="eventprocessingissue", unique_together={("raw_event", "processing_issue")}
        ),
        migrations.AlterUniqueTogether(
            name="eventattachment", unique_together={("project_id", "event_id", "file")}
        ),
        migrations.AlterIndexTogether(
            name="eventattachment", index_together={("project_id", "date_added")}
        ),
        migrations.AlterUniqueTogether(
            name="environmentproject", unique_together={("project", "environment")}
        ),
        migrations.AlterUniqueTogether(
            name="environment", unique_together={("organization_id", "name")}
        ),
        migrations.AlterUniqueTogether(name="distribution", unique_together={("release", "name")}),
        migrations.AlterUniqueTogether(
            name="discoversavedqueryproject",
            unique_together={("project", "discover_saved_query")},
        ),
        migrations.AlterUniqueTogether(
            name="dashboard", unique_together={("organization", "title")}
        ),
        migrations.AlterUniqueTogether(
            name="commitfilechange", unique_together={("commit", "filename")}
        ),
        migrations.AlterUniqueTogether(name="commit", unique_together={("repository_id", "key")}),
        migrations.AlterIndexTogether(
            name="commit", index_together={("repository_id", "date_added")}
        ),
        migrations.AlterUniqueTogether(
            name="broadcastseen", unique_together={("broadcast", "user")}
        ),
        migrations.AlterUniqueTogether(
            name="authidentity",
            unique_together={("auth_provider", "ident"), ("auth_provider", "user")},
        ),
        migrations.AlterUniqueTogether(name="authenticator", unique_together={("user", "type")}),
        migrations.AlterUniqueTogether(
            name="assistantactivity", unique_together={("user", "guide_id")}
        ),
        migrations.AlterUniqueTogether(
            name="apiauthorization", unique_together={("user", "application")}
        ),
        # XXX(dcramer): these are manually generated and ported from South
        migrations.RunSQL(
            """
        create or replace function sentry_increment_project_counter(
                project bigint, delta int) returns int as $$
            declare
            new_val int;
            begin
            loop
                update sentry_projectcounter set value = value + delta
                where project_id = project
                returning value into new_val;
                if found then
                return new_val;
                end if;
                begin
                insert into sentry_projectcounter(project_id, value)
                    values (project, delta)
                    returning value into new_val;
                return new_val;
                exception when unique_violation then
                end;
            end loop;
            end
            $$ language plpgsql;
        """
        ),
        migrations.RunSQL(
            """
        CREATE UNIQUE INDEX sentry_savedsearch_is_global_6793a2f9e1b59b95
        ON sentry_savedsearch USING btree (is_global, name)
        WHERE is_global
        """
        ),
        migrations.RunSQL(
            """
        CREATE UNIQUE INDEX sentry_savedsearch_organization_id_313a24e907cdef99
        ON sentry_savedsearch USING btree (organization_id, name, type)
        WHERE (owner_id IS NULL);
        """
        ),
    ]
