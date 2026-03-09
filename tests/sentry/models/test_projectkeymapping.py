from sentry.models.projectkey import ProjectKey
from sentry.models.projectkeymapping import ProjectKeyMapping
from sentry.silo.base import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import assume_test_silo_mode, create_test_regions, region_silo_test


@django_db_all(transaction=True)
@region_silo_test(regions=create_test_regions("us"), include_monolith_run=True)
def test_project_key_mapping_claimed_on_create() -> None:
    org = Factories.create_organization()
    project = Factories.create_project(organization=org)
    key = Factories.create_project_key(project=project)

    with assume_test_silo_mode(SiloMode.CONTROL):
        mapping = ProjectKeyMapping.objects.get(public_key=key.public_key)
        assert mapping.cell_name
        assert mapping.project_key_id == key.id


@django_db_all(transaction=True)
@region_silo_test(regions=create_test_regions("us"), include_monolith_run=True)
def test_project_key_mappings_deleted_on_project_delete() -> None:
    org = Factories.create_organization()
    project = Factories.create_project(organization=org)
    key = Factories.create_project_key(project=project)
    public_key = key.public_key

    project.delete()

    with assume_test_silo_mode(SiloMode.CONTROL):
        assert not ProjectKeyMapping.objects.filter(public_key=public_key).exists()


@django_db_all(transaction=True)
@region_silo_test(regions=create_test_regions("us"), include_monolith_run=True)
def test_project_key_mapping_deleted_on_key_delete() -> None:
    org = Factories.create_organization()
    project = Factories.create_project(organization=org)
    key = Factories.create_project_key(project=project)
    public_key = key.public_key

    key.delete()

    with assume_test_silo_mode(SiloMode.CONTROL):
        assert not ProjectKeyMapping.objects.filter(public_key=public_key).exists()


@django_db_all(transaction=True)
@region_silo_test(regions=create_test_regions("us"), include_monolith_run=True)
def test_project_key_mapping_replaced_on_public_key_update() -> None:
    org = Factories.create_organization()
    project = Factories.create_project(organization=org)
    key = ProjectKey.objects.get(project=project)
    old_public_key = key.public_key

    key.public_key = ProjectKey.generate_api_key()
    key.save()

    with assume_test_silo_mode(SiloMode.CONTROL):
        assert old_public_key is not None
        assert not ProjectKeyMapping.objects.filter(public_key=old_public_key).exists()
        mapping = ProjectKeyMapping.objects.get(public_key=key.public_key)
        assert mapping.cell_name
        assert mapping.project_key_id == key.id
