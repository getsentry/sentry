from __future__ import absolute_import


DEFAULT_PROMPTS = {
    "releases": {"required_fields": ["organization_id", "project_id"]},
    "suspect_commits": {"required_fields": ["organization_id", "project_id"]},
    "alert_stream": {"required_fields": ["organization_id"]},
}


class PromptsConfig(object):
    """
    Used to configure available 'prompts' (frontend modals or UI that may be
    dismissed or have some other action recorded about it). This config
    declares what prompts are available And what fields may be required.

    required_fields available: [organization_id, project_id]
    """

    def __init__(self, prompts):
        self.prompts = prompts

    def add(self, name, config):
        if self.has(name):
            raise Exception(u"Prompt key {} is already in use".format(name))
        if "required_fields" not in config:
            raise Exception("'required_fields' must be present in the config dict")

        self.prompts[name] = config

    def has(self, name):
        return name in self.prompts

    def get(self, name):
        return self.prompts[name]

    def required_fields(self, name):
        return self.prompts[name]["required_fields"]


prompt_config = PromptsConfig(DEFAULT_PROMPTS)
