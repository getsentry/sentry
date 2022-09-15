def apply_performance_conditions(conditions, group):
    conditions.append([["has", ["group_ids", group.id]], "=", 1])
    return conditions
