from __future__ import annotations

import re
from dataclasses import dataclass, field

MAX_REPEAT = 1000

UNSUPPORTED_SUFFIX = (
    "Patterns are matched with RE2, which has no backreferences, lookaround, "
    "or other PCRE extensions."
)

_ESCAPES_OUTSIDE_CLASS = frozenset("abdfnprstvwxzABCDPQSW")
_ESCAPES_INSIDE_CLASS = frozenset("adfnprstvwxDPSW")
_CLASS_ESCAPES = frozenset("dDsSwWpP")
_UNICODE_CATEGORY_LETTERS = frozenset("CLMNPSZ")
_POSIX_CLASSES = frozenset(
    {
        "alnum",
        "alpha",
        "ascii",
        "blank",
        "cntrl",
        "digit",
        "graph",
        "lower",
        "print",
        "punct",
        "space",
        "upper",
        "word",
        "xdigit",
    }
)
_FLAGS = frozenset("imsU")
_GROUP_NAME = re.compile(r"\w+")
_HEX = re.compile(r"[0-9A-Fa-f]{2}")
_BRACED_HEX = re.compile(r"\{([0-9A-Fa-f]+)\}")
_REPEAT = re.compile(r"\{(\d+)(,(\d*))?\}")
_OCTAL = re.compile(r"0[0-7]{0,2}|[1-7][0-7]{1,2}")


class RE2SyntaxError(Exception):
    pass


def _unsupported(construct: str) -> RE2SyntaxError:
    return RE2SyntaxError(f"Invalid regex: `{construct}` is not supported. {UNSUPPORTED_SUFFIX}")


def _invalid(reason: str) -> RE2SyntaxError:
    return RE2SyntaxError(f"Invalid regex: {reason}")


@dataclass
class _Group:
    # The largest repeat product of any one alternative, which is what RE2 caps at MAX_REPEAT
    max_product: int = 1
    alternative_product: int = 1


@dataclass
class _Scanner:
    """Checks a pattern against the RE2 syntax that ClickHouse's `match()` accepts.

    Python's `re` disagrees with RE2 in both directions (lookaround and backreferences on one
    side, `\\pL`, `\\z` and some character class ranges on the other), so it can't vouch for
    a pattern that is about to reach ClickHouse.
    """

    pattern: str
    pos: int = 0
    groups: list[_Group] = field(default_factory=lambda: [_Group()])
    can_repeat: bool = False
    just_repeated: bool = False
    just_made_lazy: bool = False
    last_atom_product: int = 1

    def peek(self, offset: int = 0) -> str:
        index = self.pos + offset
        return self.pattern[index] if index < len(self.pattern) else ""

    def scan(self) -> None:
        while self.pos < len(self.pattern):
            char = self.pattern[self.pos]
            if char == "\\":
                self.scan_escape()
            elif char == "[":
                self.scan_class()
                self.atom()
            elif char == "(":
                self.scan_group_open()
            elif char == ")":
                self.scan_group_close()
            elif char == "|":
                group = self.groups[-1]
                group.max_product = max(group.max_product, group.alternative_product)
                group.alternative_product = 1
                self.pos += 1
                self.reset_repeat_state(can_repeat=False)
            elif char in "*+?":
                self.scan_repetition(char, 1)
            elif char == "{" and (match := _REPEAT.match(self.pattern, self.pos)):
                self.scan_counted_repetition(match)
            else:
                self.pos += 1
                self.atom()

        if len(self.groups) > 1:
            raise _invalid("missing ), unterminated subpattern")

    def reset_repeat_state(self, *, can_repeat: bool, product: int = 1) -> None:
        self.can_repeat = can_repeat
        self.just_repeated = False
        self.just_made_lazy = False
        self.last_atom_product = product

    def atom(self, product: int = 1) -> None:
        self.reset_repeat_state(can_repeat=True, product=product)
        self.record_product(product)

    def record_product(self, product: int) -> None:
        group = self.groups[-1]
        group.alternative_product = max(group.alternative_product, product)

    def scan_repetition(self, operator: str, count: int) -> None:
        if operator == "?" and self.just_repeated and not self.just_made_lazy:
            self.just_made_lazy = True
            self.pos += 1
            return
        if self.just_repeated:
            previous = self.pattern[self.pos - 1]
            if operator == "+" and not self.just_made_lazy:
                raise _unsupported(f"{previous}+")
            raise _invalid("multiple repeat")
        if not self.can_repeat:
            raise _invalid("nothing to repeat")

        self.pos += 1
        self.apply_repeat_count(count)

    def scan_counted_repetition(self, match: re.Match[str]) -> None:
        minimum = int(match.group(1))
        maximum_text = match.group(3)
        maximum = int(maximum_text) if maximum_text else None
        if maximum is not None and maximum < minimum:
            raise _invalid("min repeat greater than max repeat")
        if max(minimum, maximum or 0) > MAX_REPEAT:
            raise _invalid(f"repetition counts are limited to {MAX_REPEAT}")
        if self.just_repeated:
            raise _invalid("multiple repeat")
        if not self.can_repeat:
            raise _invalid("nothing to repeat")

        self.pos = match.end()
        self.apply_repeat_count(maximum if maximum is not None else minimum)

    def apply_repeat_count(self, count: int) -> None:
        product = self.last_atom_product * count
        if product > MAX_REPEAT:
            raise _invalid(f"repetition counts are limited to {MAX_REPEAT}")
        self.record_product(product)
        self.last_atom_product = product
        self.just_repeated = True
        self.just_made_lazy = False

    def scan_group_open(self) -> None:
        self.pos += 1
        if self.peek() != "?":
            self.open_group()
            return

        self.pos += 1
        next_char = self.peek()
        if next_char == ":":
            self.pos += 1
            self.open_group()
        elif (
            next_char == "P"
            and self.peek(1) == "<"
            or next_char == "<"
            and self.peek(1)
            not in (
                "=",
                "!",
            )
        ):
            self.scan_named_group()
        elif next_char in _FLAGS or next_char == "-":
            self.scan_flags()
        elif next_char == "<" or next_char == "P":
            raise _unsupported(f"(?{next_char}{self.peek(1)}")
        elif next_char == "":
            raise _invalid("missing ), unterminated subpattern")
        else:
            raise _unsupported(f"(?{next_char}")

    def scan_named_group(self) -> None:
        if self.peek() == "P":
            self.pos += 1
        self.pos += 1
        name = _GROUP_NAME.match(self.pattern, self.pos)
        if name is None or self.pattern[name.end() : name.end() + 1] != ">":
            raise _invalid("bad named capture group")
        self.pos = name.end() + 1
        self.open_group()

    def scan_flags(self) -> None:
        start = self.pos
        seen_negation = False
        flags_after_negation = 0
        flag_count = 0
        while (char := self.peek()) not in (")", ":"):
            if char == "":
                raise _invalid("missing ), unterminated subpattern")
            if char == "-":
                if seen_negation:
                    raise _invalid("bad inline flags")
                seen_negation = True
            elif char in _FLAGS:
                flag_count += 1
                if seen_negation:
                    flags_after_negation += 1
            elif char.isalpha():
                raise _unsupported(f"(?{self.pattern[start : self.pos + 1]}")
            else:
                raise _invalid("bad inline flags")
            self.pos += 1

        if flag_count == 0 or seen_negation and flags_after_negation == 0:
            raise _invalid("bad inline flags")

        if self.peek() == ":":
            self.pos += 1
            self.open_group()
        else:
            # A flag group isn't an atom, so a repetition after it applies to what came before
            self.pos += 1

    def open_group(self) -> None:
        self.groups.append(_Group())
        self.reset_repeat_state(can_repeat=False)

    def scan_group_close(self) -> None:
        self.pos += 1
        if len(self.groups) == 1:
            raise _invalid("unbalanced parenthesis")

        group = self.groups.pop()
        product = max(group.max_product, group.alternative_product)
        self.atom(product)

    def scan_escape(self) -> None:
        self.pos += 1
        char = self.peek()
        if char == "":
            raise _invalid("trailing backslash")

        if char.isdigit():
            self.scan_octal_escape()
            self.atom()
        elif char == "Q":
            self.scan_quoted_literal()
        elif char in "pP":
            self.pos += 1
            self.scan_unicode_class()
            self.atom()
        elif char == "x":
            self.pos += 1
            self.scan_hex_escape()
            self.atom()
        elif char.isascii() and char.isalpha():
            if char not in _ESCAPES_OUTSIDE_CLASS:
                raise _unsupported(f"\\{char}")
            self.pos += 1
            self.atom()
        elif not char.isascii():
            raise _invalid(f"bad escape \\{char}")
        else:
            self.pos += 1
            self.atom()

    def scan_octal_escape(self) -> None:
        octal = _OCTAL.match(self.pattern, self.pos)
        if octal is None:
            raise _unsupported(f"\\{self.peek()}")
        self.pos = octal.end()

    def scan_quoted_literal(self) -> None:
        self.pos += 1
        end = self.pattern.find("\\E", self.pos)
        literal_end = len(self.pattern) if end == -1 else end
        has_literal = literal_end > self.pos
        self.pos = literal_end if end == -1 else end + 2
        if has_literal:
            self.atom()

    def scan_unicode_class(self) -> None:
        char = self.peek()
        if char == "{":
            end = self.pattern.find("}", self.pos)
            name = self.pattern[self.pos + 1 : end].removeprefix("^") if end != -1 else ""
            if not name:
                raise _invalid("bad unicode class")
            self.pos = end + 1
        elif char in _UNICODE_CATEGORY_LETTERS:
            self.pos += 1
        else:
            raise _invalid("bad unicode class")

    def scan_hex_escape(self) -> int:
        braced = _BRACED_HEX.match(self.pattern, self.pos)
        if braced is not None:
            value = int(braced.group(1), 16)
            if value > 0x10FFFF:
                raise _invalid("bad hex escape")
            self.pos = braced.end()
            return value
        plain = _HEX.match(self.pattern, self.pos)
        if plain is None:
            raise _invalid("bad hex escape")
        self.pos = plain.end()
        return int(plain.group(0), 16)

    def scan_class(self) -> None:
        self.pos += 1
        if self.peek() == "^":
            self.pos += 1

        first = True
        while True:
            char = self.peek()
            if char == "":
                raise _invalid("unterminated character set")
            if char == "]" and not first:
                self.pos += 1
                return
            first = False

            low = self.scan_class_item()
            if self.peek() == "-" and self.peek(1) not in ("]", ""):
                self.pos += 1
                high = self.scan_class_item()
                if high is None:
                    raise _invalid("bad character class range")
                if low is not None and high < low:
                    raise _invalid("bad character class range")

    def scan_class_item(self) -> int | None:
        """Consumes one class member, returning its code point, or None for a class escape
        like `\\d` or `[:alpha:]`, which can start a range (making `-` literal) but not end one."""
        char = self.peek()
        if char == "[" and self.peek(1) == ":":
            end = self.pattern.find(":]", self.pos + 2)
            name = self.pattern[self.pos + 2 : end].removeprefix("^") if end != -1 else ""
            if name not in _POSIX_CLASSES:
                raise _invalid("bad posix character class")
            self.pos = end + 2
            return None

        if char != "\\":
            self.pos += 1
            return ord(char)

        self.pos += 1
        escaped = self.peek()
        if escaped == "":
            raise _invalid("unterminated character set")
        if escaped.isdigit():
            start = self.pos
            self.scan_octal_escape()
            return int(self.pattern[start : self.pos], 8)
        if escaped == "x":
            self.pos += 1
            return self.scan_hex_escape()
        if escaped in "pP":
            self.pos += 1
            self.scan_unicode_class()
            return None
        if escaped.isascii() and escaped.isalpha():
            if escaped not in _ESCAPES_INSIDE_CLASS:
                raise _unsupported(f"\\{escaped}")
            self.pos += 1
            return None if escaped in _CLASS_ESCAPES else ord(escaped)
        if not escaped.isascii():
            raise _invalid(f"bad escape \\{escaped}")
        self.pos += 1
        return ord(escaped)


def check_re2_syntax(pattern: str) -> None:
    _Scanner(pattern).scan()
