# -*- coding: UTF-8 -*-

"""
An app with a model that is not managed for testing that South does
not try to manage it in any way
"""
from django.db import models

class Legacy(models.Model):
    
    name = models.CharField(max_length=10)
    size = models.IntegerField()
    
    class Meta:
        db_table = "legacy_table"
        managed = False
