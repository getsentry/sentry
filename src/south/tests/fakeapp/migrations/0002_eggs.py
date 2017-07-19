from south.db import db
from django.db import models

class Migration:
    
    def forwards(self):
        
        Spam = db.mock_model(model_name='Spam', db_table='southtest_spam', db_tablespace='', pk_field_name='id', pk_field_type=models.AutoField)
        
        db.create_table("southtest_eggs", (
            ('id', models.AutoField(verbose_name='ID', primary_key=True, auto_created=True)),
            ('size', models.FloatField()),
            ('quantity', models.IntegerField()),
            ('spam', models.ForeignKey(Spam)),
        ))
    
    def backwards(self):
        
        db.delete_table("southtest_eggs")

