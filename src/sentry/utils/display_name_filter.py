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
    "2g.tel",
    "bit.ly",
    "t.co",
    "tinyurl",
    "rb.gy",
    "cutt.ly",
    "shorturl",
    "is.gd",
    "v.gd",
    "ow.ly",
    "bl.ink",
]


def _has_any(lowered: str, signals: list[str]) -> bool:
    return any(s in lowered for s in signals)


def _has_cta(lowered: str) -> bool:
    return _has_any(lowered, CTA_VERBS) and _has_any(lowered, CTA_URGENCY)


_CATEGORIES: list[tuple[str, Callable[[str], bool]]] = [
    ("cryptocurrency terminology", lambda val: _has_any(val, CURRENCY_SIGNALS)),
    ("call-to-action phrases", _has_cta),
    ("URL shortener domains", lambda val: _has_any(val, SHORT_URL_SIGNALS)),
]


def check_spam_display_name(name: str) -> str | None:
    """Return an error string if the name matches 2+ spam categories, else None."""
    lowered = name.lower()
    matched_labels: list[str] = [label for label, check in _CATEGORIES if check(lowered)]
    if len(matched_labels) >= 2:
        joined = " and ".join(matched_labels)
        return f"This name contains disallowed content ({joined}). Please choose a different name."
    return None
