import dataclasses
import re
from collections import OrderedDict, defaultdict
from collections.abc import Sequence
from typing import Callable

from sentry.utils import metrics

# Function parameterization regexes can specify to provide a customized replacement string. Can also
# be used to do conditional replacement, by returning the original value in cases where replacement
# shouldn't happen.
ParameterizationReplacementFunction = Callable[[str], str]


@dataclasses.dataclass
class ParameterizationRegex:
    name: str  # name of the pattern (also used as group name in combined regex)
    raw_pattern: str  # regex pattern w/o matching group name
    raw_pattern_experimental: str | None = None
    lookbehind: str | None = None  # positive lookbehind prefix if needed
    lookahead: str | None = None  # positive lookahead postfix if needed
    # Function which takes the matched value and returns the replacement value.
    replacement_callback: ParameterizationReplacementFunction | None = None

    # These need to be used with `(?x)`, to tell the regex compiler to ignore comments
    # and unescaped whitespace, so we can use newlines and indentation for better legibility.

    @property
    def pattern(self) -> str:
        return self._get_pattern(self.raw_pattern)

    @property
    def experimental_pattern(self) -> str | None:
        if not self.raw_pattern_experimental:
            return None
        return self._get_pattern(self.raw_pattern_experimental)

    def _get_pattern(self, raw_pattern: str) -> str:
        """
        Returns the regex pattern with a named matching group and lookbehind/lookahead if needed.
        """
        prefix = rf"(?<={self.lookbehind})" if self.lookbehind else ""
        postfix = rf"(?={self.lookahead})" if self.lookahead else ""
        return rf"{prefix}(?P<{self.name}>{raw_pattern}){postfix}"


DEFAULT_PARAMETERIZATION_REGEXES = [
    ParameterizationRegex(
        name="email",
        raw_pattern=r"""[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*""",
    ),
    ParameterizationRegex(name="url", raw_pattern=r"""\b(wss?|https?|ftp)://[^\s/$.?#].[^\s]*"""),
    ParameterizationRegex(
        name="hostname",
        raw_pattern=r"""
            # Top 100 TLDs. The complete list is 1000s long.
            \b
            ([a-zA-Z0-9\-]{1,63}\.)+?
            (
                (COM|NET|ORG|JP|DE|UK|FR|BR|IT|RU|ES|ME|GOV|PL|CA|AU|CN|CO|IN|NL|EDU|INFO|EU|CH|ID|AT|KR|CZ|MX|BE|TV|SE|TR|TW|AL|UA|IR|VN|CL|SK|LY|CC|TO|NO|FI|US|PT|DK|AR|HU|TK|GR|IL|NEWS|RO|MY|BIZ|IE|ZA|NZ|SG|EE|TH|IO|XYZ|PE|BG|HK|RS|LT|LINK|PH|CLUB|SI|SITE|MOBI|BY|CAT|WIKI|LA|GA|XXX|CF|HR|NG|JOBS|ONLINE|KZ|UG|GQ|AE|IS|LV|PRO|FM|TIPS|MS|SA|APP)|
                (com|net|org|jp|de|uk|fr|br|it|ru|es|me|gov|pl|ca|au|cn|co|in|nl|edu|info|eu|ch|id|at|kr|cz|mx|be|tv|se|tr|tw|al|ua|ir|vn|cl|sk|ly|cc|to|no|fi|us|pt|dk|ar|hu|tk|gr|il|news|ro|my|biz|ie|za|nz|sg|ee|th|io|xyz|pe|bg|hk|rs|lt|link|ph|club|si|site|mobi|by|cat|wiki|la|ga|xxx|cf|hr|ng|jobs|online|kz|ug|gq|ae|is|lv|pro|fm|tips|ms|sa|app)
            )
            \b
        """,
    ),
    ParameterizationRegex(
        name="ip",
        raw_pattern=r"""
            # This negative lookbehind ensures two things (depending on the pattern):
            #     - We don't match starting in the middle of a valid set of initial characters
            #     - We don't match things like `::` when they appear in expressions like `SomeClass::someMethod()`
            (?<![0-9a-zA-Z_])
            (
                ([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|
                ([0-9a-fA-F]{1,4}:){1,7}:|
                ([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|
                ([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|
                ([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|
                ([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|
                ([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|
                [0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|
                :((:[0-9a-fA-F]{1,4}){1,7}|:)|
                fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|
                ::(ffff(:0{1,4}){0,1}:){0,1}
                ((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}
                (25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|
                ([0-9a-fA-F]{1,4}:){1,4}:
                ((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}
                (25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\b
            )
            # This negative lookahead works with the negative lookbehind above to block false
            # positives on expressions of the form `SomeClass::someMethod()`, ensuring that even if
            # the class name is valid hex, the method name being invalid will block the match
            (?![0-9a-zA-Z])
            |
            (
                \b((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}
                (25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\b
            )
        """,
    ),
    ParameterizationRegex(
        name="traceparent",
        raw_pattern=r"""
            # https://www.w3.org/TR/trace-context/#traceparent-header
            (\b00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]\b) |

            # https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-request-tracing.html#request-tracing-syntax
            (\b1-[0-9a-f]{8}-[0-9a-f]{24}\b)
        """,
    ),
    ParameterizationRegex(
        name="uuid",
        raw_pattern=r"""\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b""",
    ),
    ParameterizationRegex(name="sha1", raw_pattern=r"""\b[0-9a-fA-F]{40}\b"""),
    ParameterizationRegex(name="md5", raw_pattern=r"""\b[0-9a-fA-F]{32}\b"""),
    ParameterizationRegex(
        name="date",
        raw_pattern=r"""
            # No word boundaries required around dates. Should there be?
            # RFC822, RFC1123, RFC1123Z
            ((?:Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{2,4}\s\d{1,2}:\d{1,2}(:\d{1,2})?\s([-\+][\d]{2}[0-5][\d]|(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z])))
            |
            # Similar to RFC822, but "Mon Jan 02, 1999", "Jan 02, 1999"
            (((?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s[0-3]\d,\s\d{2,4})
            |
            # RFC850
            ((?:Sun|Sunday|Mon|Monday|Tue|Tuesday|Wed|Wednesday|Thu|Thursday|Fri|Friday|Sat|Saturday),\s\d{2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}\s\d{2}:\d{2}:\d{2}\s(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z]))
            |
            # RFC3339, RFC3339Nano
            (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?([+-]?\d{2}:\d{2})?)
            |
            # JavaScript
            ((?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{2}\s\d{4}\s\d{2}:\d{2}:\d{2}\sGMT[+-]\d{4}(?:\s\([^)]+\))?)
            |
            # Datetime with timezone offset (Z=UTC):
            # (Note: These come before plain datetimes so the offset is seen as part of the time and
            # not a separate int value.)
            (
                (\d{4}-?[01]\d-?[0-3]\d[\sT][0-2]\d:?[0-5]\d:?[0-5]\d\.\d+([+-][0-2]\d:?[0-5]\d|Z))| # decimal seconds
                (\d{4}-?[01]\d-?[0-3]\d[\sT][0-2]\d:?[0-5]\d:?[0-5]\d([+-][0-2]\d:?[0-5]\d|Z))| # seconds
                (\d{4}-?[01]\d-?[0-3]\d[\sT][0-2]\d:?[0-5]\d([+-][0-2]\d:?[0-5]\d|Z)) # no seconds
            )
            |
            # Datetime
            (
                (\d{4}-?[01]\d-?[0-3]\d[\sT][0-2]\d:?[0-5]\d:?[0-5]\d\.\d+)| # decimal seconds
                (\d{4}-?[01]\d-?[0-3]\d[\sT][0-2]\d:?[0-5]\d:?[0-5]\d)| # seconds
                (\d{4}-?[01]\d-?[0-3]\d[\sT][0-2]\d:?[0-5]\d) # no seconds
            )
            |
            # Kitchen, 12-hr
            (
                (?<!\d) # Negative lookbehind to ensure hour has at most two digits
                ([1-9]|1[0-2]) # Hour, no leading zero, 1-12 hours
                :[0-5]\d # Minute
                (:[0-5]\d)? # Optional second
                (?![\d:]) # Negative lookahead to ensure second (or minute, if there are no seconds)
                          # has at most two digits, and to make sure that if there are seconds, they
                          # get consumed by the optional seconds part of the pattern (and are
                          # thereby forced to abide by its restrictions on possible values)
                (?:\s?[aApP][Mm])? # Optional, optionally-space-separated AM/PM
            )
            |
            # Kitchen, 24-hr
            (
                (?<!\d) # Negative lookbehind (same logic as 12-hr pattern above)
                (0?\d|1\d|2[0-3]) # Hour, optional leading zero, 0-23 hours
                :[0-5]\d # Minute
                (:[0-5]\d)? # Optional second
                (?![\d:]) # Negative lookahead (same logic as in 12-hr pattern above)
            )
            |
            # Date
            (\d{4}-[01]\d-[0-3]\d)
            |
            # Time
            ([0-2]\d:[0-5]\d:[0-5]\d)
            |
            # Old Date Formats, TODO: possibly safe to remove?
            (
                \b(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+)?
                (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+
                ([\d]{1,2})\s+
                ([\d]{2}:[\d]{2}:[\d]{2})\s+
                [\d]{4}
            ) |
            (
                \b(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+)?
                (0[1-9]|[1-2]?[\d]|3[01])\s+
                (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+
                (19[\d]{2}|[2-9][\d]{3})\s+
                (2[0-3]|[0-1][\d]):([0-5][\d])
                (?::(60|[0-5][\d]))?\s+
                ([-\+][\d]{2}[0-5][\d]|(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z]))
            ) |
            (datetime.datetime\(.*?\))
        """,
    ),
    ParameterizationRegex(name="duration", raw_pattern=r"""\b(\d+ms) | (\d+(\.\d+)?s)\b"""),
    ParameterizationRegex(
        name="swift_txn_id",
        raw_pattern=r"""
            # OpenStack Swift transaction IDs: "tx" + 21 hex chars + "-" + 10 hex chars,
            # optionally followed by a suffix (e.g. cluster ID or client-provided extra)
            # https://docs.openstack.org/api-ref/object-store/
            (\btx[0-9a-f]{21}-[0-9a-f]{10}\S*)
        """,
    ),
    ParameterizationRegex(
        name="hex",
        raw_pattern=r"""
            # Hex value with `0x/0X` prefix (any length, with any mix of numbers and/or letters -
            # the prefix pretty much guarantees it's hex).
            (\b0[xX][0-9a-fA-F]+\b) |

            # Hex value without `0x/0X` prefix (at least 4 characters long, containing both a letter
            # and number if shorter than 8 characters, and either all uppercase or all lowercase -
            # we're more conservative here in order to reduce false positives).
            (
                # Regular word boundary (for positive values)
                \b
                |
                # Alphanumeric negative lookbehind before the dash in negative values to ensure it's
                # only considered a minus sign if it doesn't connect two alphanumeric strings. (No
                # word boundary here because the dash serves as the word boundary, since it's not a
                # word character.)
                (?<!\w)-
            )
            (
                # The patterns for hex strings 4-6 characters long each consist of three parts:
                #   - Lookahead to guarantee at least one digit (any number of letters, followed by
                #     a single digit - doesn't have to cover the entire match, so there can continue
                #     to be letters and numbers after the digit is found)
                #   - Lookahead to guarantee at least one letter (any number of numbers, followed by
                #     a single letter - as above, doesn't have to cover the entire match)
                #   - The matcher itself - between 4 and 6 hex characters (7-character strings
                #     aren't included because those are classified as git SHAs)
                (?=[a-f]*[0-9])(?=[0-9]*[a-f])[0-9a-f]{4,6} |
                (?=[A-F]*[0-9])(?=[0-9]*[A-F])[0-9A-F]{4,6} |
                # The patterns for hex strings 8-128 characters long are less restrictive. We don't
                # require a number because exceedingly few 8+-letter words consist of only the
                # letters A-E - the string 'fabaceae' is much more likely to be hex than the Latin
                # name for the plant family which includes legumes. And we don't require a letter
                # because long strings of digits are probably more likely to be hex than to be giant
                # integers.
                [0-9a-f]{8,128} |
                [0-9A-F]{8,128}
            )
            \b
        """,
    ),
    ParameterizationRegex(
        name="git_sha",
        raw_pattern=r"""
            # This is similar to the hex pattern above, except it has lookaheads for both numbers
            # and letters, to guarantee we have at least one of each. (This means it will miss git
            # shas which consist of only letters or only numbers, but fortunately > 96% of 7-digit
            # hex values are mixed, so that's a tradeoff we're okay with.) Also, it only includes
            # lowercase letters, since git shas are always expressed that way.
            (\b(?=[a-f]*[0-9])(?=[0-9]*[a-f])[0-9a-f]{7}\b)
        """,
    ),
    ParameterizationRegex(name="float", raw_pattern=r"""-\d+\.\d+\b | \b\d+\.\d+\b"""),
    ParameterizationRegex(
        name="int",
        raw_pattern=r"""
            (
                # Regular word boundary for positive ints
                \b
                |
                # Alphanumeric negative lookbehind before the dash in negative ints (logic the same
                # as in the hex pattern above)
                (?<!\w)-
            )
            \d{1,7} # Anything 8 digits and up is considered hex
            \b
        """,
    ),
    ParameterizationRegex(
        name="quoted_str",
        raw_pattern=r"""
            '([^']+)' | "([^"]+)"
        """,
        # Using an `=` lookbehind guarantees we'll only match the value half of key-value pairs,
        # rather than all quoted strings
        lookbehind="=",
    ),
    ParameterizationRegex(
        name="bool",
        raw_pattern=r"""
            True |
            true |
            False |
            false
        """,
        # Using an `=` lookbehind guarantees we'll only match the value half of key-value pairs,
        # rather than all instances of the words 'true' and 'false'.
        lookbehind="=",
    ),
]


class Parameterizer:
    def __init__(
        self,
        # List of `ParameterizationRegex` objects defining the regexes to use. If nothing is passed,
        # the default set will be used.
        regexes: Sequence[ParameterizationRegex] = DEFAULT_PARAMETERIZATION_REGEXES,
        *,
        # List of `ParameterizationRegex.name` values, used to selectively enable pattern types. To
        # use all available parameterization, omit this argument.
        regex_keys: Sequence[str] | None = None,
        # Whether to use experimental patterns, if available. (Pattern types without an experimental
        # pattern will fall back to the standard pattern.)
        use_experimental_regexes: bool = False,
    ):
        # Filter regexes by the specified keys, if given
        if regex_keys:
            regexes = [r for r in regexes if r.name in regex_keys]

        self.is_experimental = (
            use_experimental_regexes
            # Only mark the parameterizer as experimental if there are actually any experiments
            # running. If there aren't, then both parameterizers use the default regex patterns, so
            # the "experimental" parameterizer isn't actually experimental.
            and any(r.experimental_pattern is not None for r in regexes)
        )

        if self.is_experimental:
            # This uses an `OrderedDict` to guarantee we apply the patterns in the given order.
            patterns_by_name = OrderedDict(
                (
                    r.name,
                    r.experimental_pattern if r.experimental_pattern else r.pattern,
                )
                for r in regexes
            )
        else:
            patterns_by_name = OrderedDict((r.name, r.pattern) for r in regexes)

        # Combine the individual patterns into one giant regex to check against. (This is faster
        # than checking each pattern individually because it entails less overhead.)
        self.combined_regex = re.compile(
            # The `(?x)` tells the regex compiler to ignore comments and unescaped whitespace, so we
            # can use newlines and indentation for better legibility when defining regexes
            rf"(?x){'|'.join(patterns_by_name.values())}"
        )

        # Collect replacement callbacks, if any
        self.replacement_functions = {
            r.name: r.replacement_callback for r in regexes if r.replacement_callback
        }

        # Store the individual regexes in case we need to handle replacement function false
        # positives by manually looping through the patterns. This uses an `OrderedDict` to
        # guarantee we apply them in the same order as in the main/combined regex.
        self.compiled_regexes_by_name = OrderedDict(
            (name, re.compile(rf"(?x){pattern}")) for name, pattern in patterns_by_name.items()
        )

    def parameterize(self, input_str: str) -> str:
        """
        Replace all regex matches in the input string with placeholder strings, using the regexes
        with which the parameterizer was initialized.

        For example, turn "Error with order #1231" into "Error with order #<int>".
        """

        replacement_counts: defaultdict[str, int] = defaultdict(int)
        # Track whether any regex matches don't lead to a replacement
        found_false_positive = False

        def _handle_regex_match(match: re.Match[str]) -> str:
            # Ensure we're dealing with the flag from the outer scope, rather than shadowing it
            nonlocal found_false_positive

            # This handler gets called on two types of regexes:
            #   - The main/combination regex, which consists of a bunch of named capturing groups
            #     (with no nested named groups) separated by `|`.
            #   - Individual regexes for each pattern type, each consisting of one of the
            #     alternatives in the main regex.
            # In the former case, only one alternative can have been matched, so its group name will
            # be the only (and therefore last) matched group name. In the latter case, there is only
            # one named group to match, so its name will automatically be the only/last matched
            # group name. Thus `lastgroup` should give us the group name in either case.
            matched_key = match.lastgroup
            orig_value = match.groupdict().get(
                matched_key or ""  # Empty string for mypy appeasment
            )

            if not matched_key or not orig_value:  # Insurance - shouldn't happen IRL
                return ""

            replacement_callback = self.replacement_functions.get(matched_key)
            replacement_string = (
                replacement_callback(orig_value) if replacement_callback else f"<{matched_key}>"
            )

            # The replacement callback might return the original value, if it determines it's not
            # something which should be replaced, and we don't want to count that
            if replacement_string != orig_value:
                replacement_counts[matched_key] += 1
            else:
                found_false_positive = True

            return replacement_string

        with metrics.timer(
            "grouping.parameterize", tags={"experimental": self.is_experimental}
        ) as metric_tags:
            parameterized = self.combined_regex.sub(_handle_regex_match, input_str)

            # Our big combo regex will short-circuit when it finds a match, which is great for
            # performance but problematic in cases where a replacement callback declines to
            # parameterize a value, because then the value never gets checked against later
            # patterns. To protect against that, in those cases we cycle through all patterns
            # individually, which is slower but ensures we check them all.
            if found_false_positive:
                metric_tags["false_positive"] = True

                # Reset values before applying the patterns again
                replacement_counts = defaultdict(int)
                parameterized = input_str

                # Apply patterns one by one, with no short-circuiting
                for regex_key, regex in self.compiled_regexes_by_name.items():
                    parameterized = regex.sub(_handle_regex_match, parameterized)

            metric_tags["changed"] = parameterized != input_str

        for regex_key, count in replacement_counts.items():
            # Track the kinds of replacements being made
            metrics.incr("grouping.value_parameterized", amount=count, tags={"key": regex_key})

        return parameterized


parameterizer = Parameterizer(use_experimental_regexes=False)
experimental_parameterizer = Parameterizer(use_experimental_regexes=True)
