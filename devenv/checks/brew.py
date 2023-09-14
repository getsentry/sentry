import subprocess
from typing import Tuple

from devenv.lib import fs
from devenv.lib_check import brew
from devenv.lib_check.types import checker, fixer

tags = {"deps"}
name = "brew packages"


@checker
def check() -> Tuple[bool, str]:
    ok = True
    message = ""
    packages = brew.packages()
    # TODO: read Brewfile
    for p in ("docker",):
        if p not in packages:
            message += f"\nbrew package {p} not installed!"
            ok = False
    return ok, message


@fixer
def fix() -> Tuple[bool, str]:
    try:
        subprocess.run(("brew", "bundle"), cwd=fs.gitroot(), check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        return (
            False,
            f"""
`{e.cmd}` returned code {e.returncode}
stdout:
{e.stdout.decode()}
stderr:
{e.stderr.decode()}
""",
        )
    return True, ""
