import argparse
import glob
import os.path
import re
from collections.abc import Sequence

import tomllib


def _glob_to_re(s: str) -> str:
    if s.endswith(".*"):
        pat = rf'{re.escape(s.removesuffix(".*"))}(?:|\..*+)'
    else:
        pat = re.escape(s)
    return f"^{pat}$"


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("filenames", nargs="*")
    args = parser.parse_args(argv)

    retv = 0
    for filename in args.filenames:
        reldir = os.path.dirname(os.path.abspath(filename))

        with open(filename, "rb") as f:
            overrides = tomllib.load(f)["tool"]["mypy"]["overrides"]

        (allowlist,) = (cfg for cfg in overrides if "disable_error_code" in cfg)
        (stronglist,) = (cfg for cfg in overrides if "disallow_untyped_defs" in cfg)

        stronglist_re = re.compile("|".join(_glob_to_re(g) for g in stronglist["module"]))

        for mod in allowlist["module"]:
            if stronglist_re.fullmatch(mod):
                print(f"{filename}: {mod} is in the typing errors allowlist *and* stronglist")
                retv = 1

        for pat in stronglist["module"]:
            orig_pat = pat
            firstmod = pat.split(".")[0]
            if os.path.exists(os.path.join(reldir, "src", firstmod)):
                pat = f"src.{pat}"
            pat = pat.replace(".", "/")
            if pat.endswith("*"):
                if glob.glob(os.path.join(reldir, pat)):
                    continue
            elif os.path.exists(os.path.join(reldir, f"{pat}.py")):
                continue
            elif os.path.exists(os.path.join(reldir, pat, "__init__.py")):
                continue
            print(f"{filename}: {orig_pat} in stronglist does not match any files!")
            retv = 1

    return retv


if __name__ == "__main__":
    raise SystemExit(main())
