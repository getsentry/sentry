class MatchType:
    CONTAINS = "co"
    ENDS_WITH = "ew"
    EQUAL = "eq"
    GREATER_OR_EQUAL = "gte"
    IS_SET = "is"
    LESS_OR_EQUAL = "lte"
    NOT_CONTAINS = "nc"
    NOT_ENDS_WITH = "new"
    NOT_EQUAL = "ne"
    NOT_SET = "ns"
    NOT_STARTS_WITH = "nsw"
    STARTS_WITH = "sw"


LEVEL_MATCH_CHOICES = {
    MatchType.EQUAL: "equal to",
    MatchType.GREATER_OR_EQUAL: "greater than or equal to",
    MatchType.LESS_OR_EQUAL: "less than or equal to",
}

MATCH_CHOICES = {
    MatchType.CONTAINS: "contains",
    MatchType.ENDS_WITH: "ends with",
    MatchType.EQUAL: "equals",
    MatchType.IS_SET: "is set",
    MatchType.NOT_CONTAINS: "does not contain",
    MatchType.NOT_ENDS_WITH: "does not end with",
    MatchType.NOT_EQUAL: "does not equal",
    MatchType.NOT_SET: "is not set",
    MatchType.NOT_STARTS_WITH: "does not start with",
    MatchType.STARTS_WITH: "starts with",
}
