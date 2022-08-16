from sentry.models.group import GroupType


class Issue:
    type = "error"
    subtype = GroupType.ERROR.name


class TransactionPerformanceIssue:
    type = "performance"

    def subtype(self):
        raise NotImplementedError()


class TransactionNPlusOneIssue(TransactionPerformanceIssue):
    subtype = GroupType.PERFORMANCE_N_PLUS_ONE.name


class TransactionSlowSpanIssue(TransactionPerformanceIssue):
    subtype = GroupType.PERFORMANCE_SLOW_SPAN.name
