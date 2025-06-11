from django.db import models


class MigrationRunTest(models.Model):
    name = models.CharField(max_length=255)

    class Meta:
        indexes = [models.Index(name="migration_run_test_name_idx", fields=["name"])]
