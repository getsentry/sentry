import pyperf

from sentry.utils.pytest.sentry import pytest_configure

pytest_configure({})
from codeowners_1mb_fixture import CODEOWNERS
from sentry.models import ProjectCodeOwners, ProjectOwnership, User
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import Feature

runner = pyperf.Runner()

try:
    user = Factories.create_user("admin@sentry.io", is_superuser=True)
except Exception:
    user = User.objects.get(email="admin@sentry.io")

organization = Factories.create_organization(name="sentry", owner=user)

external_teams = [
    "@getsentry/explore-aviators",
    "@getsentry/architects",
    "@getsentry/aster",
    "@getsentry/athene",
    "@getsentry/basketcases",
    "@getsentry/beagle",
    "@getsentry/bilby",
    "@getsentry/bolt",
    "@getsentry/boxoffice",
    "@getsentry/chat-leaders",
    "@getsentry/chat-ops",
    "@getsentry/ci-platform",
    "@getsentry/compute-accelerate",
    "@getsentry/compute-platform",
    "@getsentry/cosmos",
    "@getsentry/dba",
    "@getsentry/dining-philosophers",
    "@getsentry/dovetail",
    "@getsentry/echidna",
    "@getsentry/edge-dns",
    "@getsentry/edge-infra",
    "@getsentry/edge-self-service",
    "@getsentry/edge-us",
    "@getsentry/emporium-b",
    "@getsentry/emporium-galaxy",
    "@getsentry/eng-prod-emea",
    "@getsentry/enigma",
    "@getsentry/everops",
    "@getsentry/falcon",
    "@getsentry/fang",
    "@getsentry/fangorn",
    "@getsentry/fellow-kids",
    "@getsentry/foundation-analytics-data-catalog",
    "@getsentry/foundation-analytics-stream",
    "@getsentry/gecko",
    "@getsentry/glider",
    "@getsentry/goanna",
    "@getsentry/groot",
    "@getsentry/guide-dev",
    "@getsentry/guide-ops",
    "@getsentry/harrier",
    "@getsentry/hawkeye",
    "@getsentry/hibiscus",
    "@getsentry/i18n",
    "@getsentry/icarus",
    "@getsentry/iris",
    "@getsentry/kelpie",
    "@getsentry/kepler",
    "@getsentry/kingfisher",
    "@getsentry/koalai",
    "@getsentry/kookaburra",
    "@getsentry/kopi",
    "@getsentry/kowari",
    "@getsentry/lavender",
    "@getsentry/libretto",
    "@getsentry/localization",
    "@getsentry/lockbox",
    "@getsentry/magnolia",
    "@getsentry/network",
    "@getsentry/nexus",
    "@getsentry/ohana",
    "@getsentry/one-graph",
    "@getsentry/optimize",
    "@getsentry/orca",
    "@getsentry/orchid",
    "@getsentry/osprey",
    "@getsentry/otters",
    "@getsentry/pcc-deploy",
    "@getsentry/pcc-history",
    "@getsentry/pcc-operations",
    "@getsentry/pegasus",
    "@getsentry/penguin",
    "@getsentry/pikachu",
    "@getsentry/pingu",
    "@getsentry/piratos",
    "@getsentry/polo",
    "@getsentry/ponderosa",
    "@getsentry/popcorn",
    "@getsentry/prism",
    "@getsentry/productivity-develop",
    "@getsentry/productivity-scooter-experience",
    "@getsentry/productivity-scooter-platform",
    "@getsentry/red-pandas",
    "@getsentry/redpandas",
    "@getsentry/ruby-core",
    "@getsentry/sabre",
    "@getsentry/secure",
    "@getsentry/sell-flow",
    "@getsentry/sell-search",
    "@getsentry/skvader",
    "@getsentry/snoop",
    "@getsentry/soju",
    "@getsentry/spacedogs",
    "@getsentry/spike",
    "@getsentry/spyglass",
    "@getsentry/squonk",
    "@getsentry/strong-bad",
    "@getsentry/strongbad",
    "@getsentry/tealeaves",
    "@getsentry/teapot",
    "@getsentry/test-frameworks",
    "@getsentry/test-frameworks-and-standards",
    "@getsentry/test-infra",
    "@getsentry/test-platform",
    "@getsentry/ultra",
    "@getsentry/vega",
    "@getsentry/vikings",
    "@getsentry/vinyl",
    "@getsentry/waratah",
    "@getsentry/wattle",
    "@getsentry/wollemi",
    "@getsentry/woodstock",
    "@getsentry/ecosystem",
    "@getsentry/docs",
]

project = Factories.create_project(name="foo", organization=organization)
integration = Factories.create_integration(
    organization=organization,
    provider="github",
    external_id=organization.id,
    metadata={"domain_name": "github.com/Test-Org"},
)
organization_integration = integration.add_organization(organization)
repository = Factories.create_repo(
    project=project, name="repo1", provider="github", integration_id=integration.id
)


for name in external_teams:
    sentry_team = Factories.create_team(
        organization=organization, name=name.split("@getsentry/")[1]
    )
    project.add_team(sentry_team)
    Factories.create_external_team(
        external_name=name,
        team=sentry_team,
        organization=organization,
        integration_id=integration.id,
    )

codeowners_list = []
for i in range(1, 16):
    code_mapping = Factories.create_code_mapping(
        project=project,
        repo=repository,
        organization_integration=organization_integration,
        stack_root=f"/compiled_{i}/",
        source_root="/app",
    )

    codeowners = Factories.create_codeowners(project=project, code_mapping=code_mapping)
    codeowners.update_schema(CODEOWNERS)
    codeowners_list.append(codeowners)

merged_codeowners = ProjectCodeOwners.merge_code_owners_list(codeowners_list)
example_issue_data = {
    "stacktrace": {
        "frames": [{"filename": "foo/file.py"}, {"abs_path": "/usr/local/src/other/app.py"}]
    }
}


def baseline_func():
    ProjectOwnership._matching_ownership_rules(merged_codeowners, example_issue_data)


def improved_func():
    with Feature("organizations:scaleable_codeowners_search"):
        ProjectOwnership._matching_ownership_rules(merged_codeowners, example_issue_data)


runner.bench_func("baseline_func", baseline_func)
runner.bench_func("improved_func", improved_func)
