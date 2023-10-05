from sentry.models.file import File
from sentry.testutils.cases import TestMigrations


class RemoveFlatFileIndexFiles(TestMigrations):
    migrate_from = "0571_add_hybrid_cloud_foreign_key_to_slug_reservation"
    migrate_to = "0572_rm_cficache_symcache"

    def setup_before_migration(self, apps):
        File.objects.create(name="some_cficache_file", type="project.cficache")
        File.objects.create(name="some_symcache_file", type="project.symcache")
        File.objects.create(name="some_other_file", type="project.dif")

    def test_only_deleted_obsolete_files(self):
        assert File.objects.count() == 1
