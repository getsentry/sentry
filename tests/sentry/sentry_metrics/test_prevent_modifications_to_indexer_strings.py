from hashlib import sha256

LOCKED_FILE = "src/sentry/sentry_metrics/indexer/strings.py"
LOCKED_DIGEST = "a0395ac3cc5c59712f1875c69b107575a13a5c79b730a37508eea0aa4ab73675"
MESSAGE = f"""{LOCKED_FILE} is locked.

* We have detected you made changes to this file.
* We've locked this file following INC-680.
* Please remove the changes to this file.
"""


def test_prevent_indexer_strings_modification():
    with open(LOCKED_FILE, "rb") as f:
        digest = sha256(f.read()).hexdigest()
        assert LOCKED_DIGEST == digest, MESSAGE
