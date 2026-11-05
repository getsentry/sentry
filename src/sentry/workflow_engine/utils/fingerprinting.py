def build_detector_issue_fingerprint(
    detector_id: int, issue_type_id: int, problem_key: str
) -> list[str]:
    """Group a recurring problem within one detector and issue type.

    Use a stable problem key: repeated findings share a key, separate problems do not.
    Keep the identity in one entry, since each fingerprint entry is an alternative
    grouping hash.
    """
    return [f"detector:{detector_id}:type:{issue_type_id}:problem:{problem_key}"]
