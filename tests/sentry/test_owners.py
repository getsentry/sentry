import sentry_sdk
from sentry_sdk import Scope

from sentry.owners import OWNER_ATTRIBUTE, Owner, set_owner


def _code_owner_teams() -> set[str]:
    teams: set[str] = set()
    with open(".github/CODEOWNERS") as code_owners_file:
        for line in code_owners_file:
            if line.startswith("/src/"):
                tokens = [s.strip() for s in line.split("@getsentry/")]
                teams.update(tokens[1:])
    return teams


def test_owner_is_a_valid_code_owner() -> None:
    teams = _code_owner_teams()

    for owner in Owner:
        if owner != Owner.UNOWNED:
            assert owner.value in teams


def test_set_owner_defaults_to_isolation_scope() -> None:
    with sentry_sdk.isolation_scope() as scope:
        set_owner(Owner.CRONS)

        assert scope._tags[OWNER_ATTRIBUTE] == "crons"
        assert scope._attributes[OWNER_ATTRIBUTE] == "crons"


def test_set_owner_on_given_scope() -> None:
    scope = Scope()

    set_owner(Owner.CRONS, scope=scope)

    assert scope._tags[OWNER_ATTRIBUTE] == "crons"
    assert scope._attributes[OWNER_ATTRIBUTE] == "crons"
