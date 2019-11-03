from __future__ import absolute_import

from django.conf import settings
from sentry.utils.services import Service

from sentry.utils import metrics
import logging

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

    # print ("Selector Function Called! Method:", method)
    # print ("Backends Selected:", backends)
    return backends


def callback_func(context, method, callargs, backends, results):
    # print (__name__)
    # print ("Callback Function Called!")
    # print ("Backends:", backends)
    if backends == ["default", "moresnuba"] and method == "query":
        # print ("Both backends have run - doing analysis on their results!")
        default_result = results[0].result().results
        moresnuba_result = results[1].result().results

        from sentry.models import Group

        # default_result.append(Group.objects.create(id=123123))
        moresnuba_result.append(Group(id=123123))
        # print ("default_results:", default_result)
        # print ("moresnuba_results:", moresnuba_result)

        calculate_and_log_similarity(default_result, moresnuba_result)

    # else:
    # print ("Only one backend used; doing nothing.")

    return


def calculate_and_log_similarity(default_result, snuba_result):
    # print ("Calculating similarity between:", default_result, snuba_result)
    default_result_ids = set(r.id for r in default_result)
    snuba_result_ids = set(r.id for r in snuba_result)

    in_default_not_snuba = default_result_ids - snuba_result_ids
    in_snuba_not_default = snuba_result_ids - default_result_ids
    # print ("in_default_not_snuba", in_default_not_snuba)
    # print ("in_snuba_not_default", in_snuba_not_default)

    if len(in_snuba_not_default) == 0 and len(in_default_not_snuba) == 0:
        # Exact match
        overall_score = 1
    else:
        all_result_ids = default_result_ids | snuba_result_ids
        results_in_both_sets = default_result_ids & snuba_result_ids

        # print ("All result IDs:", all_result_ids)
        # print ("Results in both:", results_in_both_sets)
        # print (float(len(results_in_both_sets)) / float(len(all_result_ids)))
        # print (len(results_in_both_sets))
        # print (len(all_result_ids))
        try:
            overall_score = float(len(results_in_both_sets)) / float(len(all_result_ids))
        except ZeroDivisionError:
            overall_score = 1

    # print ("Analysis Complete!")
    # print ("Sending statistics to Datadog!")
    metrics.timing("snubasearch.match.score", overall_score)

    if in_default_not_snuba:
        log_key_difference("in_default", in_default_not_snuba)

    if in_snuba_not_default:
        log_key_difference("in_moresnuba", in_snuba_not_default)

    return


def log_key_difference(mismatch_type, mismatch_keys):
    logger.error(
        "search.mismatch.keys",
        extra={
            "search_mismatch_type": mismatch_type,
            "search_mismatch_keys": list(mismatch_keys),
            "search_mismatch_num_keys": len(mismatch_keys),
        },
    )
