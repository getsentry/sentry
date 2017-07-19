
from south.tests import Monkeypatcher, skipUnless
from south.modelsinspector import (convert_on_delete_handler, get_value,
    IsDefault, models, value_clean)

from fakeapp.models import HorribleModel, get_sentinel_object


on_delete_is_available = hasattr(models, "PROTECT") # models here is django.db.models
skipUnlessOnDeleteAvailable = skipUnless(on_delete_is_available, "not testing on_delete -- not available on Django<1.3")                    

class TestModelInspector(Monkeypatcher):

    """
    Tests if the various parts of the modelinspector work.
    """
    
    def test_get_value(self):
        
        # Let's start nicely.
        name = HorribleModel._meta.get_field_by_name("name")[0]
        slug = HorribleModel._meta.get_field_by_name("slug")[0]
        user = HorribleModel._meta.get_field_by_name("user")[0]
        
        # Simple int retrieval
        self.assertEqual(
            get_value(name, ["max_length", {}]),
            "255",
        )
        
        # Bool retrieval
        self.assertEqual(
            get_value(slug, ["unique", {}]),
            "True",
        )
        
        # String retrieval
        self.assertEqual(
            get_value(user, ["rel.related_name", {}]),
            "'horribles'",
        )
        
        # Default triggering
        self.assertEqual(
            get_value(slug, ["unique", {"default": False}]),
            "True",
        )
        self.assertRaises(
            IsDefault,
            get_value,
            slug,
            ["unique", {"default": True}],
        )

    @skipUnlessOnDeleteAvailable
    def test_get_value_on_delete(self):

        # First validate the FK fields with on_delete options
        o_set_null_on_delete = HorribleModel._meta.get_field_by_name("o_set_null_on_delete")[0]
        o_cascade_delete = HorribleModel._meta.get_field_by_name("o_cascade_delete")[0]
        o_protect = HorribleModel._meta.get_field_by_name("o_protect")[0]
        o_default_on_delete = HorribleModel._meta.get_field_by_name("o_default_on_delete")[0]
        o_set_on_delete_function = HorribleModel._meta.get_field_by_name("o_set_on_delete_function")[0]
        o_set_on_delete_value = HorribleModel._meta.get_field_by_name("o_set_on_delete_value")[0]
        o_no_action_on_delete = HorribleModel._meta.get_field_by_name("o_no_action_on_delete")[0]
        # TODO this is repeated from the introspection_details in modelsinspector:
        # better to refactor that so we can reference these settings, in case they
        # must change at some point.
        on_delete = ["rel.on_delete", {"default": models.CASCADE, "is_django_function": True, "converter": convert_on_delete_handler, }]
        
        # Foreign Key cascade update/delete
        self.assertRaises(
            IsDefault,
            get_value,
            o_cascade_delete,
            on_delete,
        )
        self.assertEqual(
            get_value(o_protect, on_delete),
            "models.PROTECT",
        )
        self.assertEqual(
            get_value(o_no_action_on_delete, on_delete),
            "models.DO_NOTHING",
        )
        self.assertEqual(
            get_value(o_set_null_on_delete, on_delete),
            "models.SET_NULL",
        )
        self.assertEqual(
            get_value(o_default_on_delete, on_delete),
            "models.SET_DEFAULT",
        )
        # For now o_set_on_delete raises, see modelsinspector.py
        #self.assertEqual(
        #    get_value(o_set_on_delete_function, on_delete),
        #    "models.SET(get_sentinel_object)",
        #)
        self.assertRaises(
            ValueError,
            get_value,
            o_set_on_delete_function,
            on_delete,
        )
        self.assertEqual(
            get_value(o_set_on_delete_value, on_delete),
            "models.SET(%s)" % value_clean(get_sentinel_object()),
        )
        