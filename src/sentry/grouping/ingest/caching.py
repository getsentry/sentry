# Note: These functions are in their own module to avoid circular imports.


def get_grouphash_existence_cache_key(hash_value: str, project_id: int) -> str:
    return f"secondary_grouphash_existence:{project_id}:{hash_value}"


def get_grouphash_object_cache_key(hash_value: str, project_id: int) -> str:
    return f"grouphash_with_assigned_group:{project_id}:{hash_value}"
