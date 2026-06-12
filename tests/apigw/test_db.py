from apigw.dsl import cell_for_organization_query
from sentry.models.organizationmapping import OrganizationMapping
from sentry.testutils.silo import assume_test_silo_mode_of


def test_sql() -> None:
    # apigw runs in control silo mode (see apigw.config), where the
    # organization mapping lives
    with assume_test_silo_mode_of(OrganizationMapping):
        sql, params = cell_for_organization_query("1337")
    assert "%s" not in sql
    assert "$1" in sql
    assert "LIMIT 1" in sql
    assert "organization_id" in sql
    assert len(params) == 1

    with assume_test_silo_mode_of(OrganizationMapping):
        sql, params = cell_for_organization_query("test-org")
    assert "%s" not in sql
    assert "$1" in sql
    assert "LIMIT 1" in sql
    assert "slug" in sql
    assert len(params) == 1
