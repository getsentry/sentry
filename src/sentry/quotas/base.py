from __future__ import absolute_import

import six

from django.conf import settings
from django.core.cache import cache

from sentry import options
from sentry.utils.services import Service


class RateLimit(object):
    __slots__ = ["is_limited", "retry_after", "reason", "reason_code"]

    def __init__(self, is_limited, retry_after=None, reason=None, reason_code=None):
        self.is_limited = is_limited
        # delta of seconds in the future to retry
        self.retry_after = retry_after
        # human readable description
        self.reason = reason
        # machine readable description
        self.reason_code = reason_code

    def to_dict(self):
        """
        Converts the object into a plain dictionary
        :return: a dict containing the non None elm of the RateLimit

        >>> x = RateLimit(is_limited = False, retry_after = 33)
        >>> x.to_dict() == {'is_limited': False, 'retry_after': 33}
        True

        """
        return {
            name: getattr(self, name, None)
            for name in self.__slots__
            if getattr(self, name, None) is not None
        }


class NotRateLimited(RateLimit):
    def __init__(self, **kwargs):
        super(NotRateLimited, self).__init__(False, **kwargs)


class RateLimited(RateLimit):
    def __init__(self, **kwargs):
        super(RateLimited, self).__init__(True, **kwargs)


def _limit_from_settings(x):
    """
    limit=0 (or any falsy value) in database means "no limit". Convert that to
    limit=None as limit=0 in code means "reject all"
    """

    return int(x or 0) or None


class Quota(Service):
    """
    Quotas handle tracking a project's event usage (at a per minute tick) and
    respond whether or not a project has been configured to throttle incoming
    events if they go beyond the specified quota.
    """

    __all__ = (
        "get_maximum_quota",
        "get_organization_quota",
        "get_project_quota",
        "is_rate_limited",
        "translate_quota",
        "validate",
        "refund",
        "get_event_retention",
        "get_quotas",
    )

    def __init__(self, **options):
        pass

    def is_rate_limited(self, project, key=None):
        return NotRateLimited()

    def refund(self, project, key=None, timestamp=None):
        raise NotImplementedError

    def get_time_remaining(self):
        return 0

    def translate_quota(self, quota, parent_quota):
        if six.text_type(quota).endswith("%"):
            pct = int(quota[:-1])
            quota = int(parent_quota or 0) * pct / 100

        return _limit_from_settings(quota or parent_quota)

    def get_key_quota(self, key):
        from sentry import features

        # XXX(epurkhiser): Avoid excessive feature manager checks (which can be
        # expensive depending on feature handlers) for project rate limits.
        # This happens on /store.
        cache_key = u"project:{}:features:rate-limits".format(key.project.id)

        has_rate_limits = cache.get(cache_key)
        if has_rate_limits is None:
            has_rate_limits = features.has("projects:rate-limits", key.project)
            cache.set(cache_key, has_rate_limits, 600)

        if not has_rate_limits:
            return (None, None)

        limit, window = key.rate_limit
        return _limit_from_settings(limit), window

    def get_project_quota(self, project):
        from sentry.models import Organization, OrganizationOption

        org = getattr(project, "_organization_cache", None)
        if not org:
            org = Organization.objects.get_from_cache(id=project.organization_id)
            project._organization_cache = org

        max_quota_share = int(
            OrganizationOption.objects.get_value(org, "sentry:project-rate-limit", 100)
        )

        org_quota, window = self.get_organization_quota(org)

        if max_quota_share != 100 and org_quota:
            quota = self.translate_quota(u"{}%".format(max_quota_share), org_quota)
        else:
            quota = None

        return (quota, window)

    def get_organization_quota(self, organization):
        from sentry.models import OrganizationOption

        account_limit = _limit_from_settings(
            OrganizationOption.objects.get_value(
                organization=organization, key="sentry:account-rate-limit", default=0
            )
        )

        system_limit = _limit_from_settings(options.get("system.rate-limit"))

        # If there is only a single org, this one org should
        # be allowed to consume the entire quota.
        if settings.SENTRY_SINGLE_ORGANIZATION or account_limit:
            if system_limit and (not account_limit or system_limit < account_limit / 60):
                return (system_limit, 60)
            # an account limit is enforced, which is set as a fixed value and cannot
            # utilize percentage based limits
            return (account_limit, 3600)

        return (
            self.translate_quota(settings.SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE, system_limit),
            60,
        )

    def get_maximum_quota(self, organization):
        """
        Return the maximum capable rate for an organization.
        """
        return (_limit_from_settings(options.get("system.rate-limit")), 60)

    def get_event_retention(self, organization):
        return _limit_from_settings(options.get("system.event-retention-days"))

    def get_quotas(self, project, key=None):
        return []
