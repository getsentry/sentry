from __future__ import absolute_import

import six

from django.conf import settings
from django.core.cache import cache

from sentry import options
from sentry.utils.json import prune_empty_keys
from sentry.utils.services import Service


class QuotaConfig(object):
    """
    Abstract configuration for a quota.

    Sentry applies multiple quotas to an event before accepting it, some of
    which can be configured by the user depending on plan. An event will be
    counted against all quotas that it matches with based on the ``category``.
    For example:

    * If Sentry is told to apply two quotas "one event per minute" and "9999999
      events per hour", it will practically accept only one event per minute
    * If Sentry is told to apply "one event per minute" and "30 events per
      hour", we will be able to get one event accepted every minute. However, if
      we do that for 30 minutes (ingesting 30 events), we will not be able to
      get an event through for the rest of the hour. (This example assumes that
      we start sending events exactly at the start of the time window)

    The `QuotaConfig` object is not persisted, but is the contract between
    Sentry and Relay. Most importantly, a `QuotaConfig` instance does not
    contain information about how many events can still be accepted, it only
    represents settings that should be applied. The actual counts are in the
    rate limiter (e.g. implemented via Redis caches).
    """

    __slots__ = ["id", "subscope", "limit", "window", "reason_code"]

    def __init__(self, id=None, subscope=None, limit=None, window=None, reason_code=None):
        if limit == 0:
            assert id is None and subscope is None, "zero-sized quotas are not tracked in redis"
            assert window is None, "zero-sized quotas cannot have a window"
        else:
            assert id, "measured quotas need a id to run in redis"
            assert window and window > 0, "window cannot be zero"

        self.id = id
        self.subscope = subscope
        # maximum number of events in the given window
        #
        # None indicates "unlimited amount"
        # 0 indicates "reject all"
        # NOTE: Use `quotas.base._limit_from_settings` to map from settings
        self.limit = limit
        # time in seconds that this quota reflects
        self.window = window
        # a machine readable string
        self.reason_code = reason_code

    @classmethod
    def reject_all(cls, reason_code):
        """
        A zero-sized quota, which is never counted in Redis. Unconditionally
        reject the event.
        """

        return cls(limit=0, reason_code=reason_code)

    @classmethod
    def limited(cls, id, limit, window, reason_code, subscope=None):
        """
        A regular quota with limit.
        """

        assert limit and limit > 0
        return cls(id=id, limit=limit, window=window, reason_code=reason_code, subscope=subscope)

    @classmethod
    def unlimited(cls, id, window, subscope=None):
        """
        Unlimited quota that is still being counted.
        """

        return cls(id=id, window=window, subscope=subscope)

    @property
    def should_track(self):
        """
        Whether the quotas service should track this quota at all.
        """

        return self.id is not None

    def to_json_legacy(self):
        return prune_empty_keys(
            {
                "prefix": six.text_type(self.id) if self.id is not None else None,
                "subscope": six.text_type(self.subscope) if self.subscope is not None else None,
                "limit": self.limit,
                "window": self.window,
                "reasonCode": self.reason_code,
            }
        )

    def to_json(self):
        return prune_empty_keys(
            {
                "id": six.text_type(self.id) if self.id is not None else None,
                "subscope": six.text_type(self.subscope) if self.subscope is not None else None,
                "limit": self.limit,
                "window": self.window,
                "reasonCode": self.reason_code,
            }
        )


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
