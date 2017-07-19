from south.db import db
from django.db import models

class Migration:
    
    def forwards(self):
        # Model 'Spam'
        db.create_table("southtest_spam", (
            ('id', models.AutoField(verbose_name='ID', primary_key=True, auto_created=True)),
            ('weight', models.FloatField()),
            ('expires', models.DateTimeField()),
            ('name', models.CharField(max_length=255))
        ))
    
    def backwards(self):
        db.delete_table("southtest_spam")

