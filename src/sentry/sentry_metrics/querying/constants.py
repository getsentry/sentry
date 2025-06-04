from snuba_sdk import ArithmeticOperator

# Snuba can return at most 10.000 rows.
SNUBA_QUERY_LIMIT = 10000
# Operators in formulas that use coefficients.
COEFFICIENT_OPERATORS = {
    ArithmeticOperator.DIVIDE.value,
    ArithmeticOperator.MULTIPLY.value,
}
