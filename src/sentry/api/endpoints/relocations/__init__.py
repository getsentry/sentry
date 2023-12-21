from string import Template

ERR_FEATURE_DISABLED = "This feature is not yet enabled"
ERR_UNKNOWN_RELOCATION_STEP = Template("`$step` is not a valid relocation step.")
ERR_COULD_NOT_PAUSE_RELOCATION_AT_STEP = Template(
    """Could not pause relocation at step `$step`; this is likely because this step has already
    started."""
)
