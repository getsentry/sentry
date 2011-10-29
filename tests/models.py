from django.db import models
from sentry.models import GzippedDictField

class TestModel(models.Model):
    data = GzippedDictField(blank=True, null=True)
    
    def __unicode__(self):
        return unicode(self.data)

class DuplicateKeyModel(models.Model):
    foo = models.IntegerField(unique=True, default=1)
    
    def __unicode__(self):
        return unicode(self.foo)
    