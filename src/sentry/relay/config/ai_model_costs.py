from typing import TypedDict


class AIModelCost(TypedDict):
    modelId: str
    forCompletion: bool
    costPer1kTokens: float


class AIModelCosts(TypedDict):
    version: int
    costs: list[AIModelCost]


def ai_model_costs_config() -> AIModelCosts:
    return {
        "version": 1,
        "costs": [
            {
                "modelId": row[0],
                "forCompletion": row[1],
                "costPer1kTokens": row[2],
            }
            for row in [
                # GPT-4o input
                ("gpt-4o", False, 0.005),
                ("gpt-4o-2024-05-13", False, 0.005),
                # GPT-4o output
                ("gpt-4o", True, 0.015),
                ("gpt-4o-2024-05-13", True, 0.015),
                # GPT-4 input
                ("gpt-4", False, 0.03),
                ("gpt-4-0314", False, 0.03),
                ("gpt-4-0613", False, 0.03),
                ("gpt-4-32k", False, 0.06),
                ("gpt-4-32k-0314", False, 0.06),
                ("gpt-4-32k-0613", False, 0.06),
                ("gpt-4-vision-preview", False, 0.01),
                ("gpt-4-1106-preview", False, 0.01),
                ("gpt-4-0125-preview", False, 0.01),
                ("gpt-4-turbo-preview", False, 0.01),
                ("gpt-4-turbo", False, 0.01),
                ("gpt-4-turbo-2024-04-09", False, 0.01),
                # GPT-4 output
                ("gpt-4", True, 0.06),
                ("gpt-4-0314", True, 0.06),
                ("gpt-4-0613", True, 0.06),
                ("gpt-4-32k", True, 0.12),
                ("gpt-4-32k-0314", True, 0.12),
                ("gpt-4-32k-0613", True, 0.12),
                ("gpt-4-vision-preview", True, 0.03),
                ("gpt-4-1106-preview", True, 0.03),
                ("gpt-4-0125-preview", True, 0.03),
                ("gpt-4-turbo-preview", True, 0.03),
                ("gpt-4-turbo", True, 0.03),
                ("gpt-4-turbo-2024-04-09", True, 0.03),
                # GPT-3.5 input
                ("gpt-3.5-turbo", False, 0.0005),
                ("gpt-3.5-turbo-0125", False, 0.0005),
                ("gpt-3.5-turbo-0301", False, 0.0015),
                ("gpt-3.5-turbo-0613", False, 0.0015),
                ("gpt-3.5-turbo-1106", False, 0.001),
                ("gpt-3.5-turbo-instruct", False, 0.0015),
                ("gpt-3.5-turbo-16k", False, 0.003),
                ("gpt-3.5-turbo-16k-0613", False, 0.003),
                # GPT-3.5 output
                ("gpt-3.5-turbo", True, 0.0015),
                ("gpt-3.5-turbo-0125", True, 0.0015),
                ("gpt-3.5-turbo-0301", True, 0.002),
                ("gpt-3.5-turbo-0613", True, 0.002),
                ("gpt-3.5-turbo-1106", True, 0.002),
                ("gpt-3.5-turbo-instruct", True, 0.002),
                ("gpt-3.5-turbo-16k", True, 0.004),
                ("gpt-3.5-turbo-16k-0613", True, 0.004),
                # Azure GPT-35 input
                ("gpt-35-turbo", False, 0.0015),  # Azure OpenAI version of ChatGPT
                ("gpt-35-turbo-0301", False, 0.0015),  # Azure OpenAI version of ChatGPT
                ("gpt-35-turbo-0613", False, 0.0015),
                ("gpt-35-turbo-instruct", False, 0.0015),
                ("gpt-35-turbo-16k", False, 0.003),
                ("gpt-35-turbo-16k-0613", False, 0.003),
                # Azure GPT-35 output
                ("gpt-35-turbo", True, 0.002),  # Azure OpenAI version of ChatGPT
                ("gpt-35-turbo-0301", True, 0.002),  # Azure OpenAI version of ChatGPT
                ("gpt-35-turbo-0613", True, 0.002),
                ("gpt-35-turbo-instruct", True, 0.002),
                ("gpt-35-turbo-16k", True, 0.004),
                ("gpt-35-turbo-16k-0613", True, 0.004),
                # Other OpenAI models
                ("text-ada-001", True, 0.0004),
                ("text-ada-001", False, 0.0004),
                ("ada", True, 0.0004),
                ("ada", False, 0.0004),
                ("text-babbage-001", True, 0.0005),
                ("text-babbage-001", False, 0.0005),
                ("babbage", True, 0.0005),
                ("babbage", False, 0.0005),
                ("text-curie-001", True, 0.002),
                ("text-curie-001", False, 0.002),
                ("curie", True, 0.002),
                ("curie", False, 0.002),
                ("text-davinci-003", True, 0.02),
                ("text-davinci-003", False, 0.02),
                ("text-davinci-002", True, 0.02),
                ("text-davinci-002", False, 0.02),
                ("code-davinci-002", True, 0.02),
                ("code-davinci-002", False, 0.02),
                # Fine-tuned OpenAI input
                ("ft:babbage-002", False, 0.0016),
                ("ft:davinci-002", False, 0.012),
                ("ft:gpt-3.5-turbo-0613", False, 0.012),
                ("ft:gpt-3.5-turbo-1106", False, 0.012),
                # Fine-tuned OpenAI output
                ("ft:babbage-002", True, 0.0016),
                ("ft:davinci-002", True, 0.012),
                ("ft:gpt-3.5-turbo-0613", True, 0.016),
                ("ft:gpt-3.5-turbo-1106", True, 0.016),
                # Azure OpenAI Fine-tuned input
                ("babbage-002.ft-*", False, 0.0004),
                ("davinci-002.ft-*", False, 0.002),
                ("gpt-35-turbo-0613.ft-*", False, 0.0015),
                # Azure OpenAI Fine-tuned output
                ("babbage-002.ft-*", True, 0.0004),
                ("davinci-002.ft-*", True, 0.002),
                ("gpt-35-turbo-0613.ft-*", True, 0.002),
                # Legacy OpenAI Fine-tuned models input
                ("ada:ft-*", True, 0.0016),
                ("babbage:ft-*", True, 0.0024),
                ("curie:ft-*", True, 0.012),
                ("davinci:ft-*", True, 0.12),
                # Anthropic Claude 3 input
                ("claude-3-haiku", False, 0.00025),
                ("claude-3-sonnet", False, 0.003),
                ("claude-3-opus", False, 0.015),
                # Anthropic Claude 3 output
                ("claude-3-haiku", True, 0.00125),
                ("claude-3-sonnet", True, 0.015),
                ("claude-3-opus", True, 0.075),
                # Anthropic Claude 2 input
                ("claude-2.*", False, 0.008),
                ("claude-instant*", False, 0.0008),
                # Anthropic Claude 2 output
                ("claude-2.*", True, 0.024),
                ("claude-instant*", True, 0.0024),
                # Cohere command input
                ("command", False, 0.001),
                ("command-light", False, 0.0003),
                ("command-r", False, 0.0005),
                ("command-r-plus", False, 0.003),
                # Cohere command output
                ("command", True, 0.002),
                ("command-light", True, 0.0006),
                ("command-r", True, 0.0015),
                ("command-r-plus", True, 0.015),
            ]
        ],
    }
