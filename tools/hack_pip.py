from __future__ import annotations

import os.path
import sys
import sysconfig

PTH = """\
from pip._internal.network.download import Downloader
from pip._vendor.tenacity import retry, stop_after_attempt
Downloader.__call__ = retry(
    reraise=True,
    stop=stop_after_attempt(5),
    after=lambda state: print(f'!!! retry: attempt {state.attempt_number + 1} !!!')
)(Downloader.__call__)
"""


def main() -> int:
    assert not sys.flags.no_site, sys.flags.no_site
    target = os.path.join(sysconfig.get_path("purelib"), "sentry-pip-hack.pth")
    assert "/.venv/" in target, target

    print("working around https://github.com/pypa/pip/issues/12383#issuecomment-1808598097")
    print(f"writing: {target}")
    with open(target, "w") as f:
        f.write(f"import sys;exec({PTH!r})\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
