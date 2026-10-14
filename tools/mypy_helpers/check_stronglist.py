import argparse
import glob
import os.path
import re
import tomllib
from collections.abc import Sequence


def _glob_to_re(s: str) -> str:
    if s.endswith(".*"):
        pat = rf"{re.escape(s.removesuffix('.*'))}(?:|\..*+)"
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
            config = tomllib.load(f)

        allowlist_modules = _modules_for_override_key(config, "disable_error_code", filename)
        weaklist_modules = _modules_for_override_key(config, "disallow_untyped_defs", filename)
        weaklist_re = (
            re.compile("|".join(_glob_to_re(g) for g in weaklist_modules))
            if weaklist_modules
            else None
        )

        for mod in allowlist_modules:
            if weaklist_re is None or not weaklist_re.fullmatch(mod):
                print(
                    f"{filename}: {mod} is in the typing errors allowlist but not in the weaklist"
                )
                retv = 1

        prev = ""
        for pat in weaklist_modules:
            if prev.endswith(".*") and pat.startswith(prev[:-1]):
                print(f"{filename}: {pat} in weaklist is redundant with {prev}")
                retv = 1
            elif pat == f"{prev}.*":
                print(f"{filename}: {prev} in weaklist is redundant with {pat}")
                retv = 1
            elif pat.endswith("*") and not pat.endswith(".*"):
                print(
                    f"{filename}: {pat} in weaklist is malformatted; patterns must be fully-qualified module names, optionally with '*' in some components"
                )
                retv = 1
            else:
                prev = pat

        for pat in weaklist_modules:
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
            print(f"{filename}: {orig_pat} in weaklist does not match any files!")
            retv = 1

    return retv


def _modules_for_override_key(data: dict[str, object], key: str, filename: str) -> tuple[str, ...]:
    tool = data.get("tool")
    mypy = tool.get("mypy") if isinstance(tool, dict) else None
    overrides = mypy.get("overrides", []) if isinstance(mypy, dict) else []
    if not isinstance(overrides, list):
        raise SystemExit(f"{filename}: [tool.mypy].overrides must be an array")
    matching = [cfg for cfg in overrides if isinstance(cfg, dict) and key in cfg]
    if not matching:
        return ()
    if len(matching) > 1:
        raise SystemExit(
            f"{filename}: multiple [tool.mypy.overrides] sections with "
            f"{key!r}; expected exactly one."
        )
    modules = matching[0].get("module")
    if not isinstance(modules, list) or not all(isinstance(module, str) for module in modules):
        raise SystemExit(f"{filename}: override with {key!r} must define a string module list")
    return tuple(modules)


if __name__ == "__main__":
    raise SystemExit(main())
