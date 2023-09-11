import subprocess

from devenv.lib import brew_packages, MetaCheck, gitroot


class Check(MetaCheck):
    tags = {"deps"}

    def __repr__(self):
        return "brew packages"

    def check(self):
        ok = True
        message = ""
        packages = brew_packages()
        # TODO: read Brewfile
        for p in ("docker",):
            if p not in packages:
                message += f"\nbrew package {p} not installed!"
                ok = False
        return ok, message

    def fix(self):
        try:
            subprocess.run(("brew", "bundle"), cwd=gitroot(), check=True, capture_output=True)
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
