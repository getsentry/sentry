import dataclasses
import re
from collections import defaultdict
from collections.abc import Callable, Sequence
from functools import lru_cache

import tiktoken

__all__ = [
    "ParameterizationCallable",
    "ParameterizationCallableExperiment",
    "ParameterizationExperiment",
    "ParameterizationRegex",
    "ParameterizationRegexExperiment",
    "Parameterizer",
    "UniqueIdExperiment",
]


@dataclasses.dataclass
class ParameterizationRegex:

    name: str  # name of the pattern (also used as group name in combined regex)
    raw_pattern: str  # regex pattern w/o matching group name
    lookbehind: str | None = None  # positive lookbehind prefix if needed
    lookahead: str | None = None  # positive lookahead postfix if needed
    counter: int = 0

    # These need to be used with `(?x)`, to tell the regex compiler to ignore comments
    # and unescaped whitespace, so we can use newlines and indentation for better legibility.

    @property
    def pattern(self) -> str:
        """
        Returns the regex pattern with a named matching group and lookbehind/lookahead if needed.
        """
        prefix = rf"(?<={self.lookbehind})" if self.lookbehind else ""
        postfix = rf"(?={self.lookahead})" if self.lookahead else ""
        return rf"{prefix}(?P<{self.name}>{self.raw_pattern}){postfix}"

    @property
    def compiled_pattern(self) -> re.Pattern[str]:
        """
        Returns the compiled regex pattern with a named matching group and lookbehind/lookahead if needed.
        """
        if not hasattr(self, "_compiled_pattern"):
            self._compiled_pattern = re.compile(rf"(?x){self.pattern}")
        return self._compiled_pattern


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
            ) |
            (
                \b((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}
                (25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\b
            )
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
            ((?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\s\d{2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}\s\d{2}:\d{2}:\d{2}\s(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z]))
            |
            # RFC3339, RFC3339Nano
            (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?([+-]?\d{2}:\d{2})?)
            |
            # Datetime:
            (\d{4}-?[01]\d-?[0-3]\d\s[0-2]\d:[0-5]\d:[0-5]\d)(\.\d+)?
            |
            # Kitchen
            (\d{1,2}:\d{2}(:\d{2})?(?: [aApP][Mm])?)
            |
            # Date
            (\d{4}-[01]\d-[0-3]\d)
            |
            # Time
            ([0-2]\d:[0-5]\d:[0-5]\d)
            |
            # Old Date Formats, TODO: possibly safe to remove?
            (
                (\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|
                (\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|
                (\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))
            ) |
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
    ParameterizationRegex(name="hex", raw_pattern=r"""\b0[xX][0-9a-fA-F]+\b"""),
    ParameterizationRegex(name="float", raw_pattern=r"""-\d+\.\d+\b | \b\d+\.\d+\b"""),
    ParameterizationRegex(name="int", raw_pattern=r"""-\d+\b | \b\d+\b"""),
    ParameterizationRegex(
        name="quoted_str",
        raw_pattern=r"""# Using `=`lookbehind which guarantees we'll only match the value half of key-value pairs,
            # rather than all quoted strings
            '([^']+)' | "([^"]+)"
        """,
        lookbehind="=",
    ),
    ParameterizationRegex(
        name="bool",
        raw_pattern=r"""# Using `=`lookbehind which guarantees we'll only match the value half of key-value pairs,
            # rather than all instances of the words 'true' and 'false'.
            True |
            true |
            False |
            false
        """,
        lookbehind="=",
    ),
]


DEFAULT_PARAMETERIZATION_REGEXES_MAP = {r.name: r.pattern for r in DEFAULT_PARAMETERIZATION_REGEXES}


@dataclasses.dataclass
class ParameterizationCallable:
    """
    Represents a callable that can be used to modify a string, which can give
    us more flexibility than just using regex.
    """

    name: str  # name of the pattern (also used as group name in combined regex)
    apply: Callable[[str], tuple[str, int]]  # function for modifying the input string
    counter: int = 0


@dataclasses.dataclass
class ParameterizationCallableExperiment(ParameterizationCallable):
    def run(self, content: str, callback: Callable[[str, int], None]) -> str:
        content, count = self.apply(content)
        if count:
            callback(self.name, count)
        return content


class ParameterizationRegexExperiment(ParameterizationRegex):
    def run(
        self,
        content: str,
        callback: Callable[[re.Match[str]], str],
    ) -> str:
        return self.compiled_pattern.sub(callback, content)


class _UniqueId:
    # just a namespace for the uniq_id logic, no need to instantiate

    NAME = "uniq_id"

    @staticmethod
    @lru_cache(maxsize=1)
    def tiktoken_encoding() -> tiktoken.Encoding:
        return tiktoken.get_encoding("cl100k_base")

    @staticmethod
    def num_tokens_from_string(token_str: str) -> int:
        """Returns the number of tokens in a text string."""
        num_tokens = len(_UniqueId.tiktoken_encoding().encode(token_str))
        return num_tokens

    # These are all somewhat arbitrary based on examples.
    TOKEN_LENGTH_MINIMUM = (
        4  # Tokens smaller than this are unlikely to be unique ids regardless of other attributes
    )
    TOKEN_LENGTH_RATIO_DEFAULT = 0.5
    TOKEN_LENGTH_LONG = 10
    TOKEN_LENGTH_RATIO_LONG = 0.4

    @staticmethod
    def is_probably_uniq_id(token_str: str) -> bool:
        token_str = token_str.strip("\"'[]{}():;")
        if len(token_str) < _UniqueId.TOKEN_LENGTH_MINIMUM:
            return False
        if (
            token_str[0] == "<" and token_str[-1] == ">"
        ):  # Don't replace already-parameterized tokens
            return False
        token_length_ratio = _UniqueId.num_tokens_from_string(token_str) / len(token_str)
        if (
            len(token_str) > _UniqueId.TOKEN_LENGTH_LONG
            and token_length_ratio > _UniqueId.TOKEN_LENGTH_RATIO_LONG
        ):
            return True
        return token_length_ratio > _UniqueId.TOKEN_LENGTH_RATIO_DEFAULT

    @staticmethod
    def replace_uniq_ids_in_str(string: str) -> tuple[str, int]:
        """
        Return result and count of replacements
        """
        strings = string.split(" ")
        count = 0
        for i, s in enumerate(strings):
            if _UniqueId.is_probably_uniq_id(s):
                strings[i] = "<uniq_id>"
                count += 1
        return (" ".join(strings), count)


UniqueIdExperiment = ParameterizationCallableExperiment(
    name=_UniqueId.NAME, apply=_UniqueId.replace_uniq_ids_in_str
)


ParameterizationExperiment = ParameterizationCallableExperiment | ParameterizationRegexExperiment


class Parameterizer:
    def __init__(
        self,
        regex_pattern_keys: Sequence[str],
        experiments: Sequence[ParameterizationExperiment] = (),
    ):
        self._parameterization_regex = self._make_regex_from_patterns(regex_pattern_keys)
        self._experiments = experiments

        self.matches_counter: defaultdict[str, int] = defaultdict(int)

    @staticmethod
    def _make_regex_from_patterns(pattern_keys: Sequence[str]) -> re.Pattern[str]:
        """
        Takes list of pattern keys and returns a compiled regex pattern that matches any of them.

        @param pattern_keys: A list of keys to match in the _parameterization_regex_components dict.
        @returns: A compiled regex pattern that matches any of the given keys.
        @raises: KeyError on pattern key not in the _parameterization_regex_components dict

        The `(?x)` tells the regex compiler to ignore comments and unescaped whitespace,
        so we can use newlines and indentation for better legibility in patterns above.
        """

        return re.compile(
            rf"(?x){'|'.join(DEFAULT_PARAMETERIZATION_REGEXES_MAP[k] for k in pattern_keys)}"
        )

    def parametrize_w_regex(self, content: str) -> str:
        """
        Replace all matches of the given regex in the content with a placeholder string.

        @param content: The string to replace matches in.
        @param parameterization_regex: The compiled regex pattern to match.
        @param match_callback: An optional callback function to call with the key of the matched pattern.

        @returns: The content with all matches replaced with placeholders.
        """

        def _handle_regex_match(match: re.Match[str]) -> str:
            # Find the first (should be only) non-None match entry, and sub in the placeholder. For
            # example, given the groupdict item `('hex', '0x40000015')`, this returns '<hex>' as a
            # replacement for the original value in the string.
            for key, value in match.groupdict().items():
                if value is not None:
                    self.matches_counter[key] += 1
                    return f"<{key}>"
            return ""

        return self._parameterization_regex.sub(_handle_regex_match, content)

    def parametrize_w_experiments(
        self, content: str, should_run: Callable[[str], bool] = lambda _: True
    ) -> str:
        """
        Apply all experiments to the content.

        @param content: The string to apply experiments to.
        @returns: The content with all experiments applied.
        """

        def _incr_counter(key: str, count: int) -> None:
            self.matches_counter[key] += count

        def _handle_regex_match(match: re.Match[str]) -> str:
            # Find the first (should be only) non-None match entry, and sub in the placeholder. For
            # example, given the groupdict item `('hex', '0x40000015')`, this returns '<hex>' as a
            # replacement for the original value in the string.
            for key, value in match.groupdict().items():
                if value is not None:
                    self.matches_counter[key] += 1
                    return f"<{key}>"
            return ""

        for experiment in self._experiments:
            if not should_run(experiment.name):
                continue
            if isinstance(experiment, ParameterizationCallableExperiment):
                content = experiment.run(content, _incr_counter)
            else:
                content = experiment.run(content, _handle_regex_match)

        return content

    def get_successful_experiments(self) -> Sequence[ParameterizationExperiment]:
        return [e for e in self._experiments if self.matches_counter[e.name] > 0]

    def parameterize_all(
        self, content: str, should_run: Callable[[str], bool] = lambda _: True
    ) -> str:
        return self.parametrize_w_experiments(self.parametrize_w_regex(content), should_run)
