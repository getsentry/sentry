from __future__ import annotations

from collections.abc import Callable

CURRENCY_SIGNALS: list[str] = [
    "$",
    "\U0001f4b2",  # 💲 Heavy Dollar Sign
    "\U0001f4b0",  # 💰 Money Bag
    "\U0001f4b5",  # 💵 Dollar Banknote
    "\U0001f48e",  # 💎 Gem Stone
    "\U0001fa99",  # 🪙 Coin
    "btc",
    "eth",
    "usdt",
    "crypto",
    "compensation",
    "bitcoin",
    "ethereum",
    "litecoin",
    "ltc",
    "xrp",
    "doge",
    "dogecoin",
    "bnb",
    "solana",
    "sol",
    "airdrop",
]

CTA_VERBS: list[str] = ["click", "claim", "collect", "withdraw", "act", "pay"]
CTA_URGENCY: list[str] = ["now", "here", "your", "link"]

SHORT_URL_SIGNALS: list[str] = [
    "2g.tel/",
    "bit.ly/",
    "t.co/",
    "tinyurl.com/",
    "rb.gy/",
    "cutt.ly/",
    "shorturl.at/",
    "is.gd/",
    "v.gd/",
    "ow.ly/",
    "bl.ink/",
]


def _is_word_at(text: str, pos: int, length: int) -> bool:
    """Check that the match at text[pos:pos+length] is bounded by non-alphanumeric chars."""
    if pos > 0 and text[pos - 1].isalnum():
        return False
    end = pos + length
    if end < len(text) and text[end].isalnum():
        return False
    return True


def _has_substring(lowered: str, signals: list[str]) -> bool:
    return any(s in lowered for s in signals)


def _has_word(lowered: str, signals: list[str]) -> bool:
    for signal in signals:
        pos = lowered.find(signal)
        while pos != -1:
            if _is_word_at(lowered, pos, len(signal)):
                return True
            pos = lowered.find(signal, pos + 1)
    return False


def _has_signal(lowered: str, signals: list[str]) -> bool:
    """Use word-boundary matching for alphabetic signals, substring for the rest."""
    alpha = [s for s in signals if s.isalpha()]
    other = [s for s in signals if not s.isalpha()]
    return _has_word(lowered, alpha) or _has_substring(lowered, other)


def _has_cta(lowered: str) -> bool:
    return _has_signal(lowered, CTA_VERBS) and _has_signal(lowered, CTA_URGENCY)


_CATEGORIES: list[tuple[str, Callable[[str], bool]]] = [
    ("cryptocurrency terminology", lambda val: _has_signal(val, CURRENCY_SIGNALS)),
    ("call-to-action phrases", _has_cta),
    ("URL shortener domains", lambda val: _has_signal(val, SHORT_URL_SIGNALS)),
]


def is_spam_display_name(name: str) -> bool:
    """Return True if the name matches 2+ spam signal categories."""
    lowered = name.lower()
    matched = sum(1 for _, check in _CATEGORIES if check(lowered))
    return matched >= 2
