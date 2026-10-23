from django.db import models


class KeepTable(models.Model):
    # Surviving live model. Cell and Execution reference each other and are both
    # pending-deleted; they live only in the migrations.
    pass
