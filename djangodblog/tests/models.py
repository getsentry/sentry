from django.db import models
from djangodblog.utils import JSONDictField

class JSONDictModel(models.Model):
    data = JSONDictField(blank=True, null=True)
    
    def __unicode__(self):
        return unicode(self.data)
