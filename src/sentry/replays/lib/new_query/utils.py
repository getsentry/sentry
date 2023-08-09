from snuba_sdk import Condition, Function, Op


def translate_condition_to_function(condition: Condition) -> Function:
    # Work-around for https://github.com/getsentry/snuba-sdk/issues/115
    if condition.op == Op.EQ:
        return Function("equals", parameters=[condition.lhs, condition.rhs])
    elif condition.op == Op.NEQ:
        return Function("notEquals", parameters=[condition.lhs, condition.rhs])
    elif condition.op == Op.GT:
        return Function("greater", parameters=[condition.lhs, condition.rhs])
    elif condition.op == Op.GTE:
        return Function("greaterOrEquals", parameters=[condition.lhs, condition.rhs])
    elif condition.op == Op.LT:
        return Function("less", parameters=[condition.lhs, condition.rhs])
    elif condition.op == Op.LTE:
        return Function("lessOrEquals", parameters=[condition.lhs, condition.rhs])
    elif condition.op == Op.IN:
        return Function("in", parameters=[condition.lhs, condition.rhs])
    elif condition.op == Op.NOT_IN:
        return Function("notIn", parameters=[condition.lhs, condition.rhs])
    else:
        raise Exception(f"Didn't understand operation: {condition.op}")
