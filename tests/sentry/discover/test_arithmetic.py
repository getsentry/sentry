import pytest

from sentry.discover.arithmetic import ArithmeticParseError, MaxOperatorError, parse_arithmetic

op_map = {
    "+": "plus",
    "-": "minus",
    "*": "multiply",
    "/": "divide",
}


def test_single_term():
    result = parse_arithmetic("12")
    assert result == 12.0


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
        ("-12", "+", "-34"),
        ("+12", "+", "+34"),
        ("-12", "+", "+34"),
        ("+12", "+", "-34"),
    ],
)
def test_simple_arithmetic(a, op, b):
    equation = f"{a}{op}{b}"
    result = parse_arithmetic(equation)
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
    ],
)
def test_homogenous_arithmetic(a, op1, b, op2, c):
    """Test that literal order of ops is respected assuming we don't have to worry about BEDMAS"""
    equation = f"{a}{op1}{b}{op2}{c}"
    result = parse_arithmetic(equation)
    assert result.operator == op_map[op2.strip()], equation
    assert result.lhs.operator == op_map[op1.strip()], equation
    assert result.lhs.lhs == float(a), equation
    assert result.lhs.rhs == float(b), equation
    assert result.rhs == float(c), equation


def test_mixed_arithmetic():
    result = parse_arithmetic("12 + 34 * 56")
    result.operator == "plus"
    result.lhs = 12.0
    result.rhs.operator = "multiply"
    result.rhs.lhs = 34.0
    result.rhs.rhs = 56.0

    result = parse_arithmetic("12 / 34 - 56")
    result.operator == "subtract"
    result.lhs.operator = "divide"
    result.lhs.lhs = 12.0
    result.lhs.rhs = 34.0
    result.rhs = 56.0


def test_four_terms():
    result = parse_arithmetic("1 + 2 / 3 * 4")
    assert result.operator == "plus"
    assert result.lhs == 1.0
    assert result.rhs.operator == "multiply"
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
    ],
)
def test_homogenous_four_terms(a, op1, b, op2, c, op3, d):
    """This basically tests flatten in the ArithmeticVisitor

    flatten only kicks in when its a chain of the same operator type
    """
    equation = f"{a}{op1}{b}{op2}{c}{op3}{d}"
    result = parse_arithmetic(equation)
    assert result.operator == op_map[op3.strip()], equation
    assert result.lhs.operator == op_map[op2.strip()], equation
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
    "equation",
    [
        "1 +",
        "+ 1 + 1",
        "1 + 1 +",
        "1 ** 2",
        "1 -- 1",
        "hello world",
    ],
)
def test_bad_arithmetic(equation):
    with pytest.raises(ArithmeticParseError):
        parse_arithmetic(equation)
