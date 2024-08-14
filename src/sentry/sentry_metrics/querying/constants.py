from snuba_sdk import ArithmeticOperator

# Snuba can return at most 10.000 rows.
SNUBA_QUERY_LIMIT = 10000
# Intervals in seconds which are used by the product to query data.
DEFAULT_QUERY_INTERVALS = [
    60 * 60 * 24,  # 1 day
    60 * 60 * 12,  # 12 hours
    60 * 60 * 4,  # 4 hours
    60 * 60 * 2,  # 2 hours
    60 * 60,  # 1 hour
    60 * 30,  # 30 min
    60 * 5,  # 5 min
    60,  # 1 min
]
# Operators in formulas that use coefficients.
COEFFICIENT_OPERATORS = {
    ArithmeticOperator.DIVIDE.value,
    ArithmeticOperator.MULTIPLY.value,
}
