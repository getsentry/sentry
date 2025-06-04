import pytest

from sentry.discover.arithmetic import (
    ArithmeticParseError,
    ArithmeticValidationError,
    MaxOperatorError,
    Operation,
    parse_arithmetic,
)

op_map = {
    "+": "plus",
    "-": "minus",
    "*": "multiply",
    "/": "divide",
    "÷": "divide",
}


@pytest.mark.parametrize(
    "a,op,b",
    [
        ("12", "+", "34"),
        (" 12 ", " + ", " 34 "),
        ("12", "-", "34"),
        (" 12 ", " - ", " 34 "),
        ("12", "*", "34"),
        (" 12 ", " * ", " 34 "),
        ("12", "/", "34"),
        (" 12 ", " / ", " 34 "),
        ("12", "÷", "34"),
        (" 12 ", " ÷ ", " 34 "),
        ("-12", "+", "-34"),
        ("+12", "+", "+34"),
        ("-12", "+", "+34"),
        ("+12", "+", "-34"),
        (1.2345, "+", 6.7890),
        (1.2345, "-", 6.7890),
        (1.2345, "*", 6.7890),
        (1.2345, "/", 6.7890),
        (1.2345, "÷", 6.7890),
    ],
)
def test_simple_arithmetic(a, op, b):
    equation = f"{a}{op}{b}"
    result, _, _ = parse_arithmetic(equation)
    assert result.operator == op_map[op.strip()], equation
    assert result.lhs == float(a), equation
    assert result.rhs == float(b), equation


@pytest.mark.parametrize(
    "a,op1,b,op2,c",
    [
        ("12", "+", "34", "+", "56"),
        ("12", "+", "34", "-", "56"),
        ("12", "-", "34", "+", "56"),
        ("12", "-", "34", "-", "56"),
        ("12", "*", "34", "*", "56"),
        ("12", "*", "34", "/", "56"),
        ("12", "/", "34", "*", "56"),
        ("12", "/", "34", "/", "56"),
        ("12", "*", "34", "*", "56"),
        ("12", "*", "34", "÷", "56"),
        ("12", "÷", "34", "*", "56"),
        ("12", "÷", "34", "÷", "56"),
    ],
)
def test_homogenous_arithmetic(a, op1, b, op2, c):
    """Test that literal order of ops is respected assuming we don't have to worry about BEDMAS"""
    equation = f"{a}{op1}{b}{op2}{c}"
    result, _, _ = parse_arithmetic(equation)
    assert result.operator == op_map[op2.strip()], equation
    assert isinstance(result.lhs, Operation), equation
    assert result.lhs.operator == op_map[op1.strip()], equation
    assert result.lhs.lhs == float(a), equation
    assert result.lhs.rhs == float(b), equation
    assert result.rhs == float(c), equation


def test_mixed_arithmetic():
    result, _, _ = parse_arithmetic("12 + 34 * 56")
    assert result.operator == "plus"
    assert result.lhs == 12.0
    assert isinstance(result.rhs, Operation)
    assert result.rhs.operator == "multiply"
    assert result.rhs.lhs == 34.0
    assert result.rhs.rhs == 56.0

    result, _, _ = parse_arithmetic("12 / 34 - 56")
    assert result.operator == "minus"
    assert isinstance(result.lhs, Operation)
    assert result.lhs.operator == "divide"
    assert result.lhs.lhs == 12.0
    assert result.lhs.rhs == 34.0
    assert result.rhs == 56.0


def test_four_terms():
    result, _, _ = parse_arithmetic("1 + 2 / 3 * 4")
    assert result.operator == "plus"
    assert result.lhs == 1.0
    assert isinstance(result.rhs, Operation)
    assert result.rhs.operator == "multiply"
    assert isinstance(result.rhs.lhs, Operation)
    assert result.rhs.lhs.operator == "divide"
    assert result.rhs.lhs.lhs == 2.0
    assert result.rhs.lhs.rhs == 3.0
    assert result.rhs.rhs == 4.0


def test_brackets_with_two_inner_terms():
    result, _, _ = parse_arithmetic("(1 + 2) / (3 - 4)")
    assert result.operator == "divide"
    assert isinstance(result.lhs, Operation)
    assert result.lhs.operator == "plus"
    assert result.lhs.lhs == 1.0
    assert result.lhs.rhs == 2.0
    assert isinstance(result.rhs, Operation)
    assert result.rhs.operator == "minus"
    assert result.rhs.lhs == 3.0
    assert result.rhs.rhs == 4.0


def test_brackets_with_three_inner_terms():
    result, _, _ = parse_arithmetic("(1 + 2 + 3) / 4")
    assert result.operator == "divide"
    assert isinstance(result.lhs, Operation)
    assert result.lhs.operator == "plus"
    assert isinstance(result.lhs.lhs, Operation)
    assert result.lhs.lhs.lhs == 1.0
    assert result.lhs.lhs.rhs == 2.0
    assert result.lhs.rhs == 3.0
    assert result.rhs == 4.0


def test_brackets_with_four_inner_terms():
    result, _, _ = parse_arithmetic("(1 + 2 / 3 * 4)")
    assert result.operator == "plus"
    assert result.lhs == 1.0
    assert isinstance(result.rhs, Operation)
    assert result.rhs.operator == "multiply"
    assert isinstance(result.rhs.lhs, Operation)
    assert result.rhs.lhs.operator == "divide"
    assert result.rhs.lhs.lhs == 2.0
    assert result.rhs.lhs.rhs == 3.0
    assert result.rhs.rhs == 4.0


@pytest.mark.parametrize(
    "a,op1,b,op2,c,op3,d",
    [
        ("12", "+", "34", "+", "56", "+", "78"),
        ("12", "-", "34", "-", "56", "-", "78"),
        ("12", "+", "34", "-", "56", "+", "78"),
        ("12", "-", "34", "+", "56", "-", "78"),
        ("12", "*", "34", "*", "56", "*", "78"),
        ("12", "/", "34", "/", "56", "/", "78"),
        ("12", "*", "34", "/", "56", "*", "78"),
        ("12", "/", "34", "*", "56", "/", "78"),
        ("12", "÷", "34", "÷", "56", "÷", "78"),
        ("12", "*", "34", "÷", "56", "*", "78"),
        ("12", "÷", "34", "*", "56", "÷", "78"),
    ],
)
def test_homogenous_four_terms(a, op1, b, op2, c, op3, d):
    """This basically tests flatten in the ArithmeticVisitor

    flatten only kicks in when its a chain of the same operator type
    """
    equation = f"{a}{op1}{b}{op2}{c}{op3}{d}"
    result, _, _ = parse_arithmetic(equation)
    assert result.operator == op_map[op3.strip()], equation
    assert isinstance(result.lhs, Operation), equation
    assert result.lhs.operator == op_map[op2.strip()], equation
    assert isinstance(result.lhs.lhs, Operation), equation
    assert result.lhs.lhs.operator == op_map[op1.strip()], equation
    assert result.lhs.lhs.lhs == float(a), equation
    assert result.lhs.lhs.rhs == float(b), equation
    assert result.lhs.rhs == float(c), equation
    assert result.rhs == float(d), equation


def test_max_operators():
    with pytest.raises(MaxOperatorError):
        parse_arithmetic("1 + 2 * 3 * 4", 2)

    # exactly 3 should be ok
    parse_arithmetic("1 + 2 * 3 * 4", 3)


@pytest.mark.parametrize(
    "a,op,b",
    [
        ("spans.http", "+", "spans.db"),
        ("transaction.duration", "*", 2),
        (3.1415, "+", "spans.resource"),
    ],
)
def test_field_values(a, op, b):
    for with_brackets in [False, True]:
        equation = f"{a}{op}{b}"
        if with_brackets:
            equation = f"({equation}) + 5"
        result, fields, functions = parse_arithmetic(equation)
        if with_brackets:
            assert result.operator == "plus"
            assert isinstance(result.lhs, Operation)
            assert result.rhs == 5.0
            result = result.lhs
        assert result.operator == op_map[op.strip()], equation
        assert result.lhs == a, equation
        assert result.rhs == b, equation
        assert len(functions) == 0
        if isinstance(a, str):
            assert a in fields, equation
        if isinstance(b, str):
            assert b in fields, equation


@pytest.mark.parametrize(
    "lhs,op,rhs",
    [
        ("failure_count()", "/", "count()"),
        ("percentile(0.5, transaction.duration)", "/", "max(transaction.duration)"),
        (500, "+", "count_miserable(user, 300)"),
        ("count_miserable(user, 300)", "-", 500),
        ("p50(transaction.duration)", "/", "p100(transaction.duration)"),
        ("count_if(user.email,equals,test@example.com)", "/", 2),
        (100, "-", 'count_if(some_tag,notEquals,"something(really)annoying,like\\"this\\"")'),
    ],
)
def test_function_values(lhs, op, rhs):
    for with_brackets in [False, True]:
        equation = f"{lhs}{op}{rhs}"
        if with_brackets:
            equation = f"({equation}) + 5"
        result, fields, functions = parse_arithmetic(equation)
        if with_brackets:
            assert result.operator == "plus"
            assert isinstance(result.lhs, Operation)
            assert result.rhs == 5.0
            result = result.lhs
        assert result.operator == op_map[op.strip()], equation
        assert result.lhs == lhs, equation
        assert result.rhs == rhs, equation
        assert len(fields) == 0
        if isinstance(lhs, str):
            assert lhs in functions, equation
        if isinstance(rhs, str):
            assert rhs in functions, equation


@pytest.mark.parametrize(
    "equation",
    [
        "1 +",
        "+ 1 + 1",
        "1 + 1 +",
        "1 ** 2",
        "1 -- 1",
        "hello world",
        "",
        "+",
    ],
)
def test_unparseable_arithmetic(equation):
    with pytest.raises(ArithmeticParseError):
        parse_arithmetic(equation)


@pytest.mark.parametrize(
    "equation",
    [
        "5/0",
        "spans.http/0",
        # Transaction status isn't something we want arithmetic on
        "1 + transaction.status",
        # last_seen is an aggregate, but we aren't supporting arithmetic on dates
        "last_seen() + 1",
        # Mixing fields/functions is invalid
        "p50(transaction.duration) + transaction.duration",
        # Single fields are invalid cause there's no reason to use arithmetic for them
        "12",
        "p50(transaction.duration)",
        "measurements.lcp",
        "(measurements.lcp)",
    ],
)
def test_invalid_arithmetic(equation):
    with pytest.raises(ArithmeticValidationError):
        parse_arithmetic(equation)
