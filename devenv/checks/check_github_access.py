from typing import Set, Tuple

from devenv.lib import github

tags: Set[str] = {"github"}
name = "Check Github Access"


def check() -> Tuple[bool, str]:
    result = github.check_ssh_access()
    if result:
        return True, "You have access to Github"
    return False, "You do not have access to Github"


def fix() -> Tuple[bool, str]:
    github.add_to_known_hosts()
    if not github.check_ssh_access():
        pubkey = github.generate_and_configure_ssh_keypair()
        return (
            False,
            f"""
        Failed to authenticate with an ssh key to GitHub.
We've generated and configured one for you at ~/.ssh/sentry-github.
Visit https://github.com/settings/ssh/new and add the following Authentication key:

{pubkey}

Then, you need to go to https://github.com/settings/keys, find your key,
and click Configure SSO, for the getsentry organization.
""",
        )
    return True, "You have access to Github"
