from __future__ import annotations

import enum
import re
import secrets
from typing import Any, ClassVar
from urllib.parse import urlparse

import petname
from django.conf import settings
from django.db import ProgrammingError, models
from django.forms import model_to_dict
from django.urls import reverse
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from bitfield import TypedClassBitField
from sentry import features, options
from sentry.backup.dependencies import ImportKind
from sentry.backup.helpers import ImportFlags
from sentry.backup.scopes import ImportScope, RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.manager.base import BaseManager
from sentry.silo.base import SiloMode
from sentry.tasks.relay import schedule_invalidate_project_config

_token_re = re.compile(r"^[a-f0-9]{32}$")

# TODO(dcramer): pull in enum library


class ProjectKeyStatus:
    ACTIVE = 0
    INACTIVE = 1


class ProjectKeyManager(BaseManager["ProjectKey"]):
    def post_save(self, *, instance: ProjectKey, created: bool, **kwargs: object) -> None:
        schedule_invalidate_project_config(
            public_key=instance.public_key, trigger="projectkey.post_save"
        )

    def post_delete(self, instance, **kwargs):
        schedule_invalidate_project_config(
            public_key=instance.public_key, trigger="projectkey.post_delete"
        )

    def for_request(self, request):
        """Return objects that the given request user is allowed to access"""
        from sentry.auth.superuser import is_active_superuser

        qs = self.get_queryset()
        if not is_active_superuser(request):
            qs = qs.filter(use_case=UseCase.USER.value)

        return qs


class UseCase(enum.Enum):
    """What the DSN is used for (user vs. internal submissions)"""

    """A user-visible project key"""
    USER = "user"
    """An internal project key for submitting aggregate function metrics."""
    PROFILING = "profiling"
    """ An internal project key for submitting escalating issues metrics."""
    ESCALATING_ISSUES = "escalating_issues"
    """ An internal project key for submitting events from tempest."""
    TEMPEST = "tempest"
    """ An internal project key for demo mode."""
    DEMO = "demo"


@region_silo_model
class ProjectKey(Model):
    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey("sentry.Project", related_name="key_set")
    label = models.CharField(max_length=64, blank=True, null=True)
    public_key = models.CharField(max_length=32, unique=True, null=True)
    secret_key = models.CharField(max_length=32, unique=True, null=True)

    class roles(TypedClassBitField):
        # WARNING: Only add flags to the bottom of this list
        # bitfield flags are dependent on their order and inserting/removing
        # flags from the middle of the list will cause bits to shift corrupting
        # existing data.

        # access to post events to the store endpoint
        store: bool
        # read/write access to rest API
        api: bool

        bitfield_default = ["store"]

    status = BoundedPositiveIntegerField(
        default=0,
        choices=(
            (ProjectKeyStatus.ACTIVE, _("Active")),
            (ProjectKeyStatus.INACTIVE, _("Inactive")),
        ),
        db_index=True,
    )
    date_added = models.DateTimeField(default=timezone.now, null=True)

    rate_limit_count = BoundedPositiveIntegerField(null=True)
    rate_limit_window = BoundedPositiveIntegerField(null=True)

    objects: ClassVar[ProjectKeyManager] = ProjectKeyManager(
        cache_fields=("public_key", "secret_key"),
        # store projectkeys in memcached for longer than other models,
        # specifically to make the relay_projectconfig endpoint faster.
        cache_ttl=60 * 30,
    )

    data: models.Field[dict[str, Any], dict[str, Any]] = JSONField()

    use_case = models.CharField(
        max_length=32,
        choices=[(v.value, v.value) for v in UseCase],
        default=UseCase.USER.value,
    )

    # support legacy project keys in API
    scopes = (
        "project:read",
        "project:write",
        "project:admin",
        "project:releases",
        "event:read",
        "event:write",
        "event:admin",
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectkey"

    __repr__ = sane_repr("project_id", "public_key")

    def __str__(self):
        return str(self.public_key)

    @classmethod
    def generate_api_key(cls):
        return secrets.token_hex(nbytes=16)

    @classmethod
    def looks_like_api_key(cls, key):
        return bool(_token_re.match(key))

    @classmethod
    def from_dsn(cls, dsn):
        urlparts = urlparse(dsn)

        public_key = urlparts.username
        project_id = urlparts.path.rsplit("/", 1)[-1]

        try:
            return ProjectKey.objects.get(public_key=public_key, project=project_id)
        except ValueError:
            # ValueError would come from a non-integer project_id,
            # which is obviously a DoesNotExist. We catch and rethrow this
            # so anything downstream expecting DoesNotExist works fine
            raise ProjectKey.DoesNotExist("ProjectKey matching query does not exist.")

    @classmethod
    def get_default(cls, project):
        return cls.objects.filter(
            project=project,
            roles=models.F("roles").bitor(cls.roles.store),
            status=ProjectKeyStatus.ACTIVE,
        ).first()

    @property
    def is_active(self):
        return self.status == ProjectKeyStatus.ACTIVE

    @property
    def rate_limit(self):
        if self.rate_limit_count and self.rate_limit_window:
            return (self.rate_limit_count, self.rate_limit_window)
        return (0, 0)

    def save(self, *args, **kwargs):
        if not self.public_key:
            self.public_key = ProjectKey.generate_api_key()
        if not self.secret_key:
            self.secret_key = ProjectKey.generate_api_key()
        if not self.label:
            self.label = petname.generate(2, " ", letters=10).title()
        super().save(*args, **kwargs)

    def get_dsn(self, domain=None, secure=True, public=False):
        urlparts = urlparse(self.get_endpoint(public=public))

        if not public:
            key = f"{self.public_key}:{self.secret_key}"
        else:
            assert self.public_key is not None
            key = self.public_key

        # If we do not have a scheme or domain/hostname, dsn is never valid
        if not urlparts.netloc or not urlparts.scheme:
            return ""

        return "{}://{}@{}/{}".format(
            urlparts.scheme,
            key,
            urlparts.netloc + urlparts.path,
            self.project_id,
        )

    @property
    def organization_id(self):
        return self.project.organization_id

    @property
    def organization(self):
        return self.project.organization

    @property
    def dsn_private(self):
        return self.get_dsn(public=False)

    @property
    def dsn_public(self):
        return self.get_dsn(public=True)

    @property
    def csp_endpoint(self):
        endpoint = self.get_endpoint()

        return f"{endpoint}/api/{self.project_id}/csp-report/?sentry_key={self.public_key}"

    @property
    def security_endpoint(self):
        endpoint = self.get_endpoint()

        return f"{endpoint}/api/{self.project_id}/security/?sentry_key={self.public_key}"

    @property
    def nel_endpoint(self):
        endpoint = self.get_endpoint()

        return f"{endpoint}/api/{self.project_id}/nel/?sentry_key={self.public_key}"

    @property
    def minidump_endpoint(self):
        endpoint = self.get_endpoint()

        return f"{endpoint}/api/{self.project_id}/minidump/?sentry_key={self.public_key}"

    @property
    def unreal_endpoint(self):
        return f"{self.get_endpoint()}/api/{self.project_id}/unreal/{self.public_key}/"

    @property
    def crons_endpoint(self):
        return f"{self.get_endpoint()}/api/{self.project_id}/cron/___MONITOR_SLUG___/{self.public_key}/"

    @property
    def js_sdk_loader_cdn_url(self) -> str:
        if settings.JS_SDK_LOADER_CDN_URL:
            return f"{settings.JS_SDK_LOADER_CDN_URL}{self.public_key}.min.js"
        else:
            endpoint = self.get_endpoint()
            return "{}{}".format(
                endpoint,
                reverse("sentry-js-sdk-loader", args=[self.public_key, ".min"]),
            )

    def get_endpoint(self, public=True):
        from sentry.api.utils import generate_region_url

        if public:
            endpoint = settings.SENTRY_PUBLIC_ENDPOINT or settings.SENTRY_ENDPOINT
        else:
            endpoint = settings.SENTRY_ENDPOINT

        if not endpoint and SiloMode.get_current_mode() == SiloMode.REGION:
            endpoint = generate_region_url()
        if not endpoint:
            endpoint = options.get("system.url-prefix")

        has_org_subdomain = False
        try:
            has_org_subdomain = features.has(
                "organizations:org-ingest-subdomains", self.project.organization
            )
        except ProgrammingError:
            # This happens during migration generation for the organization model.
            pass

        if has_org_subdomain:
            urlparts = urlparse(endpoint)
            if urlparts.scheme and urlparts.netloc:
                endpoint = "{}://{}.{}{}".format(
                    str(urlparts.scheme),
                    settings.SENTRY_ORG_SUBDOMAIN_TEMPLATE.format(
                        organization_id=self.project.organization_id
                    ),
                    str(urlparts.netloc),
                    str(urlparts.path),
                )

        return endpoint

    def get_allowed_origins(self):
        from sentry.utils.http import get_origins

        return get_origins(self.project)

    def get_audit_log_data(self):
        return {
            "label": self.label,
            "public_key": self.public_key,
            "secret_key": self.secret_key,
            "roles": int(self.roles),
            "status": self.status,
            "rate_limit_count": self.rate_limit_count,
            "rate_limit_window": self.rate_limit_window,
        }

    def get_scopes(self):
        return self.scopes

    def write_relocation_import(
        self, _s: ImportScope, _f: ImportFlags
    ) -> tuple[int, ImportKind] | None:
        # If there is a key collision, generate new keys.
        matching_public_key = self.__class__.objects.filter(public_key=self.public_key).first()
        if not self.public_key or matching_public_key:
            self.public_key = self.generate_api_key()
        matching_secret_key = self.__class__.objects.filter(secret_key=self.secret_key).first()
        if not self.secret_key or matching_secret_key:
            self.secret_key = self.generate_api_key()

        # ProjectKeys for the project are automatically generated at insertion time via a
        # `post_save()` hook, so the keys for the project should already exist. We simply need to
        # update them with the correct values here.
        (key, _) = ProjectKey.objects.get_or_create(
            project=self.project, defaults=model_to_dict(self)
        )
        if key:
            self.pk = key.pk
            self.save()

        return (self.pk, ImportKind.Inserted)
