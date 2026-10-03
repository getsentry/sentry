from django.db import models


class KeepTable(models.Model):
    # A surviving live model, so the app is not empty. TestTable exists only in the
    # migrations and, in the unbaked squash, is never re-pended.
    pass
