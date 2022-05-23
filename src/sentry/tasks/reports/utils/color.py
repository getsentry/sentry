import bisect
import math
from collections import OrderedDict
from functools import partial

from sentry.models import GroupHistoryStatus

PROJECT_BREAKDOWN_COLORS = ["#422C6E", "#895289", "#D6567F", "#F38150", "#F2B713"]

TOTAL_COLOR = """
linear-gradient(
    -45deg,
    #ccc 25%,
    transparent 25%,
    transparent 50%,
    #ccc 50%,
    #ccc 75%,
    transparent 75%,
    transparent
);
"""

STATUS_TO_COLOR = {
    GroupHistoryStatus.UNRESOLVED: "#FAD473",
    GroupHistoryStatus.RESOLVED: "#8ACBBC",
    GroupHistoryStatus.SET_RESOLVED_IN_RELEASE: "#8ACBBC",
    GroupHistoryStatus.SET_RESOLVED_IN_COMMIT: "#8ACBBC",
    GroupHistoryStatus.SET_RESOLVED_IN_PULL_REQUEST: "#8ACBBC",
    GroupHistoryStatus.AUTO_RESOLVED: "#8ACBBC",
    GroupHistoryStatus.IGNORED: "#DBD6E1",
    GroupHistoryStatus.UNIGNORED: "#FAD473",
    GroupHistoryStatus.ASSIGNED: "#FAAAAC",
    GroupHistoryStatus.UNASSIGNED: "#FAD473",
    GroupHistoryStatus.REGRESSED: "#FAAAAC",
    GroupHistoryStatus.DELETED: "#DBD6E1",
    GroupHistoryStatus.DELETED_AND_DISCARDED: "#DBD6E1",
    GroupHistoryStatus.REVIEWED: "#FAD473",
    GroupHistoryStatus.NEW: "#FAD473",
}


def get_percentile(values, percentile):
    # XXX: ``values`` must be sorted.
    assert 1 >= percentile > 0
    if len(values) == 0:
        return 0
    if percentile == 1:
        index = -1
    else:
        index = int(math.ceil(len(values) * percentile)) - 1
    return values[index]


def colorize(spectrum, values):
    """TODO(mgaeta): Currently unused except by tests."""
    calculate_percentile = partial(get_percentile, sorted(values))

    legend = OrderedDict()
    width = 1.0 / len(spectrum)
    for i, color in enumerate(spectrum, 1):
        legend[color] = calculate_percentile(i * width)

    find_index = partial(bisect.bisect_left, list(legend.values()))

    results = []
    for value in values:
        results.append((value, spectrum[find_index(value)]))

    return legend, results
