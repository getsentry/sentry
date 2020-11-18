from __future__ import absolute_import


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

    display = "%s %s%s" % (
        user_response.get("displayName", name),
        "- %s " % email if email else "",
        "(%s)" % name if name else "",
    )
    return user_response[user_id_field], display.strip()


def transform_jira_fields_to_form_fields(fields_list):
    """
    The fields array from Jira doesn't exactly match the Alert Rules front
    end's expected format. Massage the field names and types and put them in a dict.

    :param fields_list: Create ticket fields from Jira as an array.
    :return: The "create ticket" fields from Jira as a dict.
    """
    return {
        field["name"]: {
            key: ({"select": "choice", "text": "string"}.get(value, value))
            if key == "type"
            else value
            for key, value in field.items()
            if key != "updatesForm"
        }
        for field in fields_list
        if field["name"]
    }


def transform_jira_choices_to_strings(fields, data):
    return {
        key: ({k: v for k, v in fields[key]["choices"]}.get(value, value))
        if key in fields and fields[key]["type"] == "choice"
        else value
        for key, value in data.items()
    }
