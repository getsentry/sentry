def build_user_choice(user_response, user_id_field):
    """
    Build an (id, label) tuple from the given Jira REST API User resource,
    or return None if a tuple could not be built.
    """
    if user_id_field not in user_response:
        return None

    # The name field can be blank in jira-cloud, and the id_field varies by
    # jira-cloud and jira-server
    name = user_response.get("name", "")
    email = user_response.get("emailAddress")

    display = "{} {}{}".format(
        user_response.get("displayName", name),
        f"- {email} " if email else "",
        f"({name})" if name else "",
    )
    return user_response[user_id_field], display.strip()
