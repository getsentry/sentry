from typing import Optional, Set
from urllib.parse import urlparse

from .base import ReplacementRule


class RuleValidator:
    def __init__(self, rule: ReplacementRule, *, char_domain: Optional[str] = None) -> None:
        self._rule = rule
        self._char_domain: Set[str] = set(char_domain) if char_domain else set("*/")

    def is_valid(self) -> bool:
        if self._is_all_stars() or self._is_schema_and_all_stars():
            return False
        return True

    def _is_all_stars(self) -> bool:
        return self._is_string_all_stars(self._rule)

    def _is_string_all_stars(self, string) -> bool:
        return set(string) <= self._char_domain

    def _is_schema_and_all_stars(self) -> bool:
        """
        Return true if the rule looks like a URL scheme and stars.

        ## Examples
        `http://*/*/**` -> `True`
        `http://domain.com/*/**` -> `False`

        Rules composed by the scheme and all stars provide the same value as all
        stars: none. These rules are low quality and provide little renaming
        value.

        ## Assumptions
        - Rules are URL-parsable, otherwise `False` is returned.
        - URLs don't have queries or fragments, and thus they are ignored.
        """
        # urlparse doesn't validate the input and raises an exception if the
        # string isn't a valid URL
        try:
            url = urlparse(self._rule)
        except ValueError:
            return False

        # urlparse sets empty strings in `scheme` and `netloc` when these can't
        # be parsed.
        if url.scheme == "":
            return False
        # urlparse may extract the first `*` from the rule as the netloc. This
        # still means no netloc in the rule.
        if url.netloc not in ("", "*"):
            return False

        return self._is_string_all_stars(url.path)
