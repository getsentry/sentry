from django.db.models import F

from sentry.utils.query import RangeQuerySetWrapperWithProgressBar


def clear_flag(Model, flag_name, flag_attr_name="flags"):
    """
    This function is used to clear an existing flag value for all items in a given model
    """
    for item in RangeQuerySetWrapperWithProgressBar(Model.objects.all()):
        flags = getattr(item, flag_attr_name)
        if flags[flag_name]:
            # do a bitwise AND on a mask with all 1s except on the bit for the flag
            update_kwargs = {
                flag_attr_name: F(flag_attr_name).bitand(~getattr(Model, flag_attr_name)[flag_name])
            }
            Model.objects.filter(id=item.id).update(**update_kwargs)
