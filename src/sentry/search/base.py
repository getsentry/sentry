from __future__ import absolute_import
import logging

from django.conf import settings

from sentry.utils import metrics
from sentry.utils.services import Service

logger = logging.getLogger(__name__)

ANY = object()


class SearchBackend(Service):
    __read_methods__ = frozenset(["query"])
    __write_methods__ = frozenset()
    __all__ = __read_methods__ | __write_methods__

    def __init__(self, **options):
        pass

    def query(
        self,
        projects,
        tags=None,
        environments=None,
        sort_by="date",
        limit=100,
        cursor=None,
        count_hits=False,
        paginator_options=None,
        **parameters
    ):
        raise NotImplementedError


def selector_func(context, method, callargs):
    backends = ["default"]
    if settings.SENTRY_USE_MORESNUBA:
        backends.append("moresnuba")

    return backends


def callback_func(context, method, callargs, backends, results):
    if backends == ["default", "moresnuba"] and method == "query":
        default_result = results[0].result().results
        moresnuba_result = results[1].result().results
        calculate_and_log_similarity(default_result, moresnuba_result)
    return


def calculate_and_log_similarity(default_result, snuba_result):
    default_result_ids = set(r.id for r in default_result)
    snuba_result_ids = set(r.id for r in snuba_result)

    in_default_not_snuba = default_result_ids - snuba_result_ids
    in_snuba_not_default = snuba_result_ids - default_result_ids

    if len(in_snuba_not_default) == 0 and len(in_default_not_snuba) == 0:
        # Exact match
        overall_score = 1
    else:
        all_result_ids = default_result_ids | snuba_result_ids
        results_in_both_sets = default_result_ids & snuba_result_ids

        try:
            overall_score = float(len(results_in_both_sets)) / float(len(all_result_ids))
        except ZeroDivisionError:
            overall_score = 1

    metrics.timing("snubasearch.match.score", overall_score)

    if in_default_not_snuba or in_snuba_not_default:
        log_key_difference(in_default_not_snuba, in_snuba_not_default)

    return


def log_key_difference(mismatch_in_default, mismatch_in_moresnuba):
    logger.error(
        "search.mismatch.keys",
        extra={
            "search_mismatch_in_default": mismatch_in_default,
            "search_mismatch_in_moresnuba": mismatch_in_moresnuba,
            # "search_mismatch_type": mismatch_type,
            "search_mismatch_default_keys": list(mismatch_in_default),
            "search_mismatch_default_num_keys": len(mismatch_in_default),
            "search_mismatch_moresnuba_keys": list(mismatch_in_moresnuba),
            "search_mismatch_moresnuba_num_keys": len(mismatch_in_moresnuba),
        },
    )
