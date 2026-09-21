import pytest

from sentry.search.events.re2_syntax import RE2SyntaxError, check_re2_syntax

UNSUPPORTED = (
    "Patterns are matched with RE2, which has no backreferences, lookaround, "
    "or other PCRE extensions."
)


@pytest.mark.parametrize(
    "pattern",
    [
        pytest.param(r"^ERROR \[\d+\]", id="escaped brackets and digits"),
        pytest.param(r"a*?b+?c??d{2}?", id="lazy repetitions"),
        pytest.param(r"a{1000}b{1000}", id="repeat limit applies per atom"),
        pytest.param(r"(a{10}){100}", id="nested repeats at the limit"),
        pytest.param(r"((a{2}){2}){250}", id="deeply nested repeats at the limit"),
        pytest.param(r"(a{1000})*", id="unbounded repetition of a counted repeat"),
        pytest.param(r"a{,5}", id="brace without a minimum is a literal"),
        pytest.param(r"a{x}", id="brace without a count is a literal"),
        pytest.param(r"\pL\PL\p{Greek}\p{^Greek}\p{Lu}", id="unicode classes"),
        pytest.param(r"\x41\x{263A}\x{10FFFF}", id="hex escapes"),
        pytest.param(r"\0\01\012\12\101\1234", id="octal escapes"),
        pytest.param(r"\Q(?=.*\E+", id="quoted literal"),
        pytest.param(r"x\Q", id="unterminated quoted literal"),
        pytest.param(r"\A\b\B\z^$", id="zero-width assertions"),
        pytest.param(r"^*$*\b*", id="repeated assertions"),
        pytest.param(r"(?i)A(?-i)b(?imsU)c(?i-s:d)", id="inline flags"),
        pytest.param(r"foo(?i)bar", id="flags mid-pattern"),
        pytest.param(r"x(?i)+", id="repetition skips a flag group"),
        pytest.param(r"(?P<a>x)(?<b>y)(?P<1c>z)", id="named groups"),
        pytest.param(r"()*(|)*(?:)", id="empty groups"),
        pytest.param(r"[]a][^]a][a-][-a][\-]", id="literal brackets and dashes in classes"),
        pytest.param(r"[(?=]", id="lookahead syntax inside a class"),
        pytest.param(r"[\d-a][[:alpha:]-z][\p{Lu}-z]", id="class escape starting a range"),
        pytest.param(r"[[:alpha:]][[:^digit:]][[.a.]]", id="posix classes"),
        pytest.param(r"[\x{263A}-\x{263B}][\101-\102]", id="escaped range endpoints"),
        pytest.param(r"\/\:\ \#\-\\1", id="escaped punctuation and backslash"),
        pytest.param(r"a]}{", id="stray closing brackets"),
    ],
)
def test_accepts_a_pattern_re2_compiles(pattern: str) -> None:
    check_re2_syntax(pattern)


@pytest.mark.parametrize(
    ["pattern", "expected_message"],
    [
        pytest.param(r"(foo)\1", f"Invalid regex: `\\1` is not supported. {UNSUPPORTED}"),
        pytest.param(r"\18", f"Invalid regex: `\\1` is not supported. {UNSUPPORTED}"),
        pytest.param(r"[\1]", f"Invalid regex: `\\1` is not supported. {UNSUPPORTED}"),
        pytest.param(r"\8", f"Invalid regex: `\\8` is not supported. {UNSUPPORTED}"),
        pytest.param(r"\\\1", f"Invalid regex: `\\1` is not supported. {UNSUPPORTED}"),
        pytest.param(r"foo(?=bar)", f"Invalid regex: `(?=` is not supported. {UNSUPPORTED}"),
        pytest.param(r"foo(?!bar)", f"Invalid regex: `(?!` is not supported. {UNSUPPORTED}"),
        pytest.param(r"foo(?<=bar)", f"Invalid regex: `(?<=` is not supported. {UNSUPPORTED}"),
        pytest.param(r"foo(?<!bar)", f"Invalid regex: `(?<!` is not supported. {UNSUPPORTED}"),
        pytest.param(r"(?>foo)", f"Invalid regex: `(?>` is not supported. {UNSUPPORTED}"),
        pytest.param(r"(?#note)a", f"Invalid regex: `(?#` is not supported. {UNSUPPORTED}"),
        pytest.param(r"(a)(?(1)b|c)", f"Invalid regex: `(?(` is not supported. {UNSUPPORTED}"),
        pytest.param(r"(?P<n>a)(?P=n)", f"Invalid regex: `(?P=` is not supported. {UNSUPPORTED}"),
        pytest.param(r"(?R)", f"Invalid regex: `(?R` is not supported. {UNSUPPORTED}"),
        pytest.param(r"(?x)a b", f"Invalid regex: `(?x` is not supported. {UNSUPPORTED}"),
        pytest.param(r"(?ix)a", f"Invalid regex: `(?ix` is not supported. {UNSUPPORTED}"),
        pytest.param(r"a*+", f"Invalid regex: `*+` is not supported. {UNSUPPORTED}"),
        pytest.param(r"a++", f"Invalid regex: `++` is not supported. {UNSUPPORTED}"),
        pytest.param(r"a{2}+", f"Invalid regex: `}}+` is not supported. {UNSUPPORTED}"),
        pytest.param(r"foo\Z", f"Invalid regex: `\\Z` is not supported. {UNSUPPORTED}"),
        pytest.param(r"\u" + "00e9", f"Invalid regex: `\\u` is not supported. {UNSUPPORTED}"),
        pytest.param(r"\e", f"Invalid regex: `\\e` is not supported. {UNSUPPORTED}"),
        pytest.param(r"\cA", f"Invalid regex: `\\c` is not supported. {UNSUPPORTED}"),
        pytest.param(r"[\b]", f"Invalid regex: `\\b` is not supported. {UNSUPPORTED}"),
        pytest.param(r"[\Q]\E]", f"Invalid regex: `\\Q` is not supported. {UNSUPPORTED}"),
        pytest.param(r"a\E", f"Invalid regex: `\\E` is not supported. {UNSUPPORTED}"),
        pytest.param(r"a{1001}", "Invalid regex: repetition counts are limited to 1000"),
        pytest.param(r"a{2,1001}", "Invalid regex: repetition counts are limited to 1000"),
        pytest.param(r"(a{11}){100}", "Invalid regex: repetition counts are limited to 1000"),
        pytest.param(r"(a{2}|b{600}){2}", "Invalid regex: repetition counts are limited to 1000"),
        pytest.param(r"a{3,2}", "Invalid regex: min repeat greater than max repeat"),
        pytest.param(r"a**", "Invalid regex: multiple repeat"),
        pytest.param(r"a???", "Invalid regex: multiple repeat"),
        pytest.param(r"x{2}{3}", "Invalid regex: multiple repeat"),
        pytest.param(r"*a", "Invalid regex: nothing to repeat"),
        pytest.param(r"(?i)*", "Invalid regex: nothing to repeat"),
        pytest.param(r"\Q\E*", "Invalid regex: nothing to repeat"),
        pytest.param(r"(foo", "Invalid regex: missing ), unterminated subpattern"),
        pytest.param(r"(?i", "Invalid regex: missing ), unterminated subpattern"),
        pytest.param(r"a)", "Invalid regex: unbalanced parenthesis"),
        pytest.param("a\\", "Invalid regex: trailing backslash"),
        pytest.param(r"[a-", "Invalid regex: unterminated character set"),
        pytest.param(r"[]", "Invalid regex: unterminated character set"),
        pytest.param(r"[z-a]", "Invalid regex: bad character class range"),
        pytest.param(r"[a-\d]", "Invalid regex: bad character class range"),
        pytest.param(r"[[:bogus:]]", "Invalid regex: bad posix character class"),
        pytest.param(r"\pX", "Invalid regex: bad unicode class"),
        pytest.param(r"\p{}", "Invalid regex: bad unicode class"),
        pytest.param(r"\x4", "Invalid regex: bad hex escape"),
        pytest.param(r"\x{110000}", "Invalid regex: bad hex escape"),
        pytest.param(r"(?<>x)", "Invalid regex: bad named capture group"),
        pytest.param(r"(?i-)a", "Invalid regex: bad inline flags"),
        pytest.param(r"(?--i)a", "Invalid regex: bad inline flags"),
        pytest.param("\\é", "Invalid regex: bad escape \\é"),
    ],
)
def test_rejects_a_pattern_re2_cannot_compile(pattern: str, expected_message: str) -> None:
    with pytest.raises(RE2SyntaxError) as err:
        check_re2_syntax(pattern)

    assert str(err.value) == expected_message
