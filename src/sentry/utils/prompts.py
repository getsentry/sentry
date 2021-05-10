DEFAULT_PROMPTS = {
    "releases": {"required_fields": ["organization_id", "project_id"]},
    "suspect_commits": {"required_fields": ["organization_id", "project_id"]},
    "alert_stream": {"required_fields": ["organization_id"]},
    "sdk_updates": {"required_fields": ["organization_id"]},
    "suggest_mobile_project": {"required_fields": ["organization_id"]},
    "stacktrace_link": {"required_fields": ["organization_id", "project_id"]},
    "distributed_tracing": {"required_fields": ["organization_id", "project_id"]},
    "quick_trace_missing": {"required_fields": ["organization_id", "project_id"]},
}


class PromptsConfig:
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
            raise Exception(f"Prompt key {name} is already in use")
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
