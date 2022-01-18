import re
from urllib.parse import urlparse
from uuid import uuid4

import petname
from django.conf import settings
from django.db import models
from django.urls import reverse
from django.utils import timezone
from django.utils.translation import ugettext_lazy as _

from bitfield import BitField
from sentry import features, options
from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    sane_repr,
)
from sentry.tasks.relay import schedule_update_config_cache

_uuid4_re = re.compile(r"^[a-f0-9]{32}$")

# TODO(dcramer): pull in enum library


class ProjectKeyStatus:
    ACTIVE = 0
    INACTIVE = 1


class ProjectKeyManager(BaseManager):
    def post_save(self, instance, **kwargs):
        schedule_update_config_cache(
            public_key=instance.public_key, generate=True, update_reason="projectkey.post_save"
        )

    def post_delete(self, instance, **kwargs):
        schedule_update_config_cache(
            public_key=instance.public_key, generate=True, update_reason="projectkey.post_delete"
        )


class ProjectKey(Model):
    __include_in_export__ = True

    project = FlexibleForeignKey("sentry.Project", related_name="key_set")
    label = models.CharField(max_length=64, blank=True, null=True)
    public_key = models.CharField(max_length=32, unique=True, null=True)
    secret_key = models.CharField(max_length=32, unique=True, null=True)
    roles = BitField(
        flags=(
            # access to post events to the store endpoint
            ("store", "Event API access"),
            # read/write access to rest API
            ("api", "Web API access"),
        ),
        default=["store"],
    )
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

    objects = ProjectKeyManager(
        cache_fields=("public_key", "secret_key"),
        # store projectkeys in memcached for longer than other models,
        # specifically to make the relay_projectconfig endpoint faster.
        cache_ttl=60 * 30,
    )

    data = JSONField()

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
        return uuid4().hex

    @classmethod
    def looks_like_api_key(cls, key):
        return bool(_uuid4_re.match(key))

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
            self.label = petname.Generate(2, " ", letters=10).title()
        super().save(*args, **kwargs)

    def get_dsn(self, domain=None, secure=True, public=False):
        urlparts = urlparse(self.get_endpoint(public=public))

        if not public:
            key = f"{self.public_key}:{self.secret_key}"
        else:
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
    def minidump_endpoint(self):
        endpoint = self.get_endpoint()

        return f"{endpoint}/api/{self.project_id}/minidump/?sentry_key={self.public_key}"

    @property
    def unreal_endpoint(self):
        return f"{self.get_endpoint()}/api/{self.project_id}/unreal/{self.public_key}/"

    @property
    def js_sdk_loader_cdn_url(self):
        if settings.JS_SDK_LOADER_CDN_URL:
            return f"{settings.JS_SDK_LOADER_CDN_URL}{self.public_key}.min.js"
        else:
            endpoint = self.get_endpoint()
            return "{}{}".format(
                endpoint,
                reverse("sentry-js-sdk-loader", args=[self.public_key, ".min"]),
            )

    def get_endpoint(self, public=True):
        if public:
            endpoint = settings.SENTRY_PUBLIC_ENDPOINT or settings.SENTRY_ENDPOINT
        else:
            endpoint = settings.SENTRY_ENDPOINT

        if not endpoint:
            endpoint = options.get("system.url-prefix")

        if features.has("organizations:org-subdomains", self.project.organization):
            urlparts = urlparse(endpoint)
            if urlparts.scheme and urlparts.netloc:
                endpoint = "{}://{}.{}{}".format(
                    urlparts.scheme,
                    settings.SENTRY_ORG_SUBDOMAIN_TEMPLATE.format(
                        organization_id=self.project.organization_id
                    ),
                    urlparts.netloc,
                    urlparts.path,
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
