def get_secret_field_config(secret, help_text=None, include_prefix=False, **kwargs):
    """Generates a configuration dictionary for a secret field.

    This function creates a context dictionary that includes information about the secret field,
    including whether there is a saved value, a prefix of the secret, and any additional help text.

    Args:
        secret (str): The secret value.
        help_text (str, optional): Additional help text to display.
        include_prefix (bool, optional): Whether to include a prefix of the secret.
        **kwargs: Additional keyword arguments to include in the context.

    Returns:
        dict: A dictionary containing the configuration for the secret field.
    """
    has_saved_value = bool(secret)
    saved_text = "Only enter a new value if you wish to update the existing one. "
    context = {
        "type": "secret",
        "has_saved_value": has_saved_value,
        "prefix": (secret or "")[:4] if include_prefix else "",
        "required": not has_saved_value,
    }
    if help_text:
        context["help"] = "{}{}".format((saved_text if has_saved_value else ""), help_text)
    context.update(kwargs)
    return context
