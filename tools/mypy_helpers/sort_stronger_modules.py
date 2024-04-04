from __future__ import annotations

import argparse
from collections.abc import Sequence


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("filenames", nargs="*")
    args = parser.parse_args(argv)

    ret = 0
    for filename in args.filenames:
        with open(filename) as f:
            contents = f.read()

        rest = contents
        b1, m1, rest = rest.partition("# begin: stronger typing\n")
        b2, m2, rest = rest.partition("module = [\n")
        b3, m3, rest = rest.partition("]\n")
        b4, m4, rest = rest.partition("# end: stronger typing\n")

        b3 = "".join(sorted(frozenset(b3.splitlines(True))))

        new_contents = b1 + m1 + b2 + m2 + b3 + m3 + b4 + m4 + rest
        if new_contents != contents:
            with open(filename, "w") as f:
                f.write(new_contents)
            ret = 1

    return ret


if __name__ == "__main__":
    raise SystemExit(main())
