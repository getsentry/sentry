from enum import IntEnum

from sentry.constants import DataCategory
from sentry.utils.outcomes import Outcome


def _id_for(data_category: DataCategory, outcome: Outcome) -> int:
    return data_category | (outcome << 10)


# Usage category represents actual tracked usage within an organization.
# Importantly, billed usage is separately derived from tracked usage and just
# because usage is tracked does not mean it is billed.
#
# For example: ERROR_FILTERED is tracked but not billed.
class UsageCategoryId(IntEnum):
    ERROR_ACCEPTED = _id_for(DataCategory.ERROR, Outcome.ACCEPTED)
    ERROR_FILTERED = _id_for(DataCategory.ERROR, Outcome.FILTERED)
    ERROR_RATE_LIMITED = _id_for(DataCategory.ERROR, Outcome.RATE_LIMITED)
    ERROR_INVALID = _id_for(DataCategory.ERROR, Outcome.INVALID)
    ERROR_ABUSE = _id_for(DataCategory.ERROR, Outcome.ABUSE)
    ERROR_CLIENT_DISCARD = _id_for(DataCategory.ERROR, Outcome.CLIENT_DISCARD)
    ERROR_CARDINALITY_LIMITED = _id_for(DataCategory.ERROR, Outcome.CARDINALITY_LIMITED)
    # TODO: TRANSACTION...

    def data_category(self) -> DataCategory:
        return DataCategory(self.value & 0x3FF)

    def outcome(self) -> Outcome:
        return Outcome(self.value >> 10)

    def api_name(self) -> str:
        return f"{self.data_category().api_name()}_{self.outcome().api_name()}"
