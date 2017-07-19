# -*- coding: UTF-8 -*-

from django.db import models
from django.contrib.auth.models import User as UserAlias

from south.modelsinspector import add_introspection_rules

on_delete_is_available = hasattr(models, "PROTECT") # models here is django.db.models

def default_func():
    return "yays"

# An empty case.
class Other1(models.Model): pass

# Another one
class Other3(models.Model): pass
def get_sentinel_object():
    """
    A function to return the object to be used in place of any deleted object,
    when using the SET option for on_delete.
    """
    # Create a new one, so we always have an instance to test with. Can't work!
    return Other3()

# Nastiness.
class HorribleModel(models.Model):
    "A model to test the edge cases of model parsing"
    
    ZERO, ONE = 0, 1
    
    # First, some nice fields
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=50)
    slug = models.SlugField(unique=True)
    
    # A ForeignKey, to a model above, and then below
    o1 = models.ForeignKey(Other1)
    o2 = models.ForeignKey('Other2')
    
    if on_delete_is_available:
        o_set_null_on_delete = models.ForeignKey('Other3', null=True, on_delete=models.SET_NULL)
        o_cascade_delete = models.ForeignKey('Other3', null=True, on_delete=models.CASCADE, related_name="cascademe")
        o_protect = models.ForeignKey('Other3', null=True, on_delete=models.PROTECT, related_name="dontcascademe")
        o_default_on_delete = models.ForeignKey('Other3', null=True, default=1, on_delete=models.SET_DEFAULT, related_name="setmedefault")
        o_set_on_delete_function = models.ForeignKey('Other3', null=True, default=1, on_delete=models.SET(get_sentinel_object), related_name="setsentinel")
        o_set_on_delete_value = models.ForeignKey('Other3', null=True, default=1, on_delete=models.SET(get_sentinel_object()), related_name="setsentinelwithactualvalue") # dubious case
        o_no_action_on_delete = models.ForeignKey('Other3', null=True, default=1, on_delete=models.DO_NOTHING, related_name="deletemeatyourperil")
    
    
    # Now to something outside
    user = models.ForeignKey(UserAlias, related_name="horribles")
    
    # Unicode!
    code = models.CharField(max_length=25, default="↑↑↓↓←→←→BA")
    
    # Odd defaults!
    class_attr = models.IntegerField(default=ZERO)
    func = models.CharField(max_length=25, default=default_func)
    
    # Time to get nasty. Define a non-field choices, and use it
    choices = [('hello', '1'), ('world', '2')]
    choiced = models.CharField(max_length=20, choices=choices)
    
    class Meta:
        db_table = "my_fave"
        verbose_name = "Dr. Strangelove," + \
                     """or how I learned to stop worrying
and love the bomb"""
    
    # Now spread over multiple lines
    multiline = \
              models.TextField(
        )

# Special case.
class Other2(models.Model):
    # Try loading a field without a newline after it (inspect hates this)
    close_but_no_cigar = models.PositiveIntegerField(primary_key=True)

class CustomField(models.IntegerField):
    def __init__(self, an_other_model, **kwargs):
        super(CustomField, self).__init__(**kwargs)
        self.an_other_model = an_other_model

add_introspection_rules([
    (
        [CustomField],
        [],
        {'an_other_model': ('an_other_model', {})},
    ),
], ['^south\.tests\.fakeapp\.models\.CustomField'])

class BaseModel(models.Model):
    pass

class SubModel(BaseModel):
    others = models.ManyToManyField(Other1)
    custom = CustomField(Other2)

class CircularA(models.Model):
    c = models.ForeignKey('CircularC')

class CircularB(models.Model):
    a = models.ForeignKey(CircularA)

class CircularC(models.Model):
    b = models.ForeignKey(CircularB)

class Recursive(models.Model):
   self = models.ForeignKey('self')
