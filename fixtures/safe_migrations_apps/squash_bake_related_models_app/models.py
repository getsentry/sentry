from django.db import models


class KeepTable(models.Model):
    # Surviving live model. Alpha and Zebra are pending-deleted and live only in the
    # migrations; Alpha has a relation to Zebra.
    pass
