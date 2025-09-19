from sentry.replays.lib.new_query.conditions import StringScalar
from sentry.replays.lib.new_query.fields import FieldProtocol, StrictEqualityStringColumnField
from sentry.replays.lib.new_query.parsers import parse_uuid

existence_search_config: dict[str, FieldProtocol] = {
    "id": StrictEqualityStringColumnField("replay_id", lambda x: str(parse_uuid(x)), StringScalar),
}

existence_search_config["replay_id"] = existence_search_config["id"]
