import time
from dataclasses import dataclass
from typing import Collection, Optional, Sequence, Tuple

from sentry.utils.services import Service

Hash = str
Timestamp = int


@dataclass(frozen=True)
class Quota:
    # The number of seconds to apply the limit to.
    window_seconds: int

    # A number between 1 and `window_seconds`. Since `window_seconds` is a
    # sliding window, configure what the granularity of that window is.
    #
    # If this is equal to `window_seconds`, the quota resets to 0 every
    # `window_seconds`.  If this is a very small number, the window slides
    # "more smoothly" at the expense of having much more redis keys.
    #
    # The number of redis keys required to enforce a quota is `window_seconds /
    # granularity_seconds`.
    granularity_seconds: int

    #: How many units are allowed within the given window.
    limit: int

    def __post__init__(self) -> None:
        assert self.window_seconds % self.granularity_seconds == 0


@dataclass(frozen=True)
class RequestedQuota:
    # A string that all redis state is prefixed with. For example
    # `sentry-string-indexer` where 123 is an organization id.
    prefix: str

    # A unit is an abstract term for the object type we want to limit the
    # cardinality of.
    #
    # For example, if you want to limit the cardinality of timeseries in a
    # metrics service, this would be a set of hashes composed from `(org_id,
    # metric_name, tags)`.
    #
    # ...though you can probably omit org_id if it is already in the prefix.
    unit_hashes: Collection[Hash]

    # Which quotas to check against. The number of not-yet-seen hashes must
    # "fit" into all quotas.
    quotas: Sequence[Quota]


@dataclass(frozen=True)
class GrantedQuota:
    request: RequestedQuota

    # The subset of hashes provided by the user `self.request` that were
    # accepted by the limiter.
    granted_unit_hashes: Collection[Hash]

    # If len(granted_unit_hashes) < len(RequestedQuota.unit_hashes), this
    # contains the quotas that were reached.
    reached_quotas: Sequence[Quota]


class CardinalityLimiter(Service):
    """
    A kind of limiter that limits set cardinality instead of a rate/count.

    The high-level concepts are very similar to `sentry.ratelimits.sliding_windows`.

    Instead of passing in numbers and getting back smaller numbers, however, the
    user passes in a set and gets back a smaller set. Set elements that have
    already been observed in any quota's window are "for free" and will not
    count towards any quota.

    The implementation hasn't been finalized yet, but we expect that under the hood
    this cardinality limiter will be more expensive to operate than a simple rate
    limiter, as it needs to keep track of already-seen set elements. The memory
    usage in Redis will most likely be proportional to the set size.

    This kind of limiter does not support prefix overrides, which practically means
    that there can only be a per-org or a global limit, not both at once.
    """

    def check_within_quotas(
        self, requests: Sequence[RequestedQuota], timestamp: Optional[Timestamp] = None
    ) -> Tuple[Timestamp, Sequence[GrantedQuota]]:
        """
        Given a set of quotas requests and limits, compute how much quota could
        be consumed.

        :param requests: The requests to return "grants" for.
        :param timestamp: The timestamp of the incoming request. Defaults to
            the current timestamp.

            Providing a too old timestamp here _can_ effectively disable rate
            limits, as the older request counts may no longer be stored.
            However, consistently providing old timestamps here will work
            correctly.
        """
        if timestamp is None:
            timestamp = int(time.time())
        else:
            timestamp = int(timestamp)

        grants = [
            GrantedQuota(
                request=request, granted_unit_hashes=request.unit_hashes, reached_quotas=[]
            )
            for request in requests
        ]

        return timestamp, grants

    def use_quotas(
        self,
        requests: Sequence[RequestedQuota],
        grants: Sequence[GrantedQuota],
        timestamp: Timestamp,
    ) -> None:
        """
        Given a set of requests and the corresponding return values from
        `check_within_quotas`, consume the quotas.

        :param requests: The requests that have previously been passed to
            `check_within_quotas`.
        :param timestamp: The request timestamp that has previously been passed
            to `check_within_quotas`.
        :param grants: The return value of `check_within_quotas` which
            indicates how much quota should actually be consumed.
        """
        pass
