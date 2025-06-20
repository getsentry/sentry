import logging
import re

from sentry.llm.usecases import LLMUseCase, complete_prompt
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def make_input_prompt(
    feedbacks,
):
    feedbacks_string = "\n".join(f"- {msg}" for msg in feedbacks)
    return f"""Instructions:

You are an assistant that summarizes customer feedback. Given a list of customer feedback entries, generate a concise summary of 1-2 sentences that reflects the key themes. Begin the summary with "Users...", for example, "Users say...".

Balance specificity and generalization based on the size of the input based *only* on the themes and topics present in the list of customer feedback entries. Prioritize brevity and clarity and trying to capture what users are saying, over trying to mention random specific topics. Please don't write overly long sentences, you can leave certain things out and the decision to mention specific topics or themes should be proportional to the number of times they appear in the user feedback entries.

User Feedbacks:

{feedbacks_string}

Output Format:

<1-2 sentence summary>
"""


@metrics.wraps("feedback.summaries", sample_rate=1.0)
def generate_summary(
    feedbacks: list[str],
):
    response = complete_prompt(  # This can throw
        usecase=LLMUseCase.FEEDBACK_SUMMARIES,
        message=make_input_prompt(feedbacks),
        temperature=0.3,
        max_output_tokens=150,
    )

    if response:
        summary = parse_response(response)
    else:
        raise ValueError("Invalid response from LLM")

    return summary


def parse_response(
    text,
):
    return re.sub(r"\s+", " ", text).strip()
