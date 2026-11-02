from django.db import models


class TestTable(models.Model):
    # The field was moved to pending deletion, so it is gone from the model; the
    # baked squash re-adds the column and re-pends it. See the migrations.
    pass
