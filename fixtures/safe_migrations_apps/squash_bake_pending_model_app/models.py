from django.db import models


class KeepTable(models.Model):
    # A surviving live model, so the app is not empty (mirrors what the bake tool
    # requires). TestTable is pending-deleted and lives only in the migrations.
    pass
