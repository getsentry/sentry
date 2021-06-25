from sentry.utils.query import RangeQuerySetWrapperWithProgressBar


def clear_flag(Model, flag_name, flag_attr_name="flags"):
    """
    This function is used to clear an existing flag value for all items in a given model
    """
    for item in RangeQuerySetWrapperWithProgressBar(Model.objects.all()):
        flags = getattr(item, flag_attr_name)
        if flags[flag_name]:
            # clear the flag
            new_flag_value = flags & ~(getattr(Model, flag_attr_name)[flag_name])
            setattr(item, flag_attr_name, new_flag_value)
            item.save()
