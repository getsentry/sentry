import logging
import re

from sentry.llm.usecases import LLMUseCase, complete_prompt
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def make_input_prompt(
    feedbacks,
):
    feedbacks_string = "\n".join(f"- {msg}" for msg in feedbacks)
    return f"""Task:
Instructions: You are an AI assistant that analyzes customer feedback.
Create a summary based on the user feedbacks that is at most three sentences, and complete the sentence "Users say...". Be concise, but specific in the summary.

User Feedbacks:

{feedbacks_string}

Output Format:

Summary: <2-3 sentence summary>
"""


SUMMARY_REGEX = re.compile(r"Summary:\s*(.*)", re.DOTALL)


@metrics.wraps("feedback.summaries", sample_rate=1.0)
def generate_summary(
    feedbacks,
):
    response = complete_prompt(
        usecase=LLMUseCase.SUMMARIES,
        message=make_input_prompt(feedbacks),
        temperature=0.3,
        # max_output_tokens=20, # figure out what this does and what to set it to
    )

    if response:
        summary = parse_response(response)
    else:
        raise Exception("Invalid response from LLM")

    return summary


def parse_response(
    text,
):
    summary_match = SUMMARY_REGEX.search(text)
    if summary_match:
        summary_text = summary_match.group(1).strip()
        return summary_text
    else:
        logger.error("Error parsing AI feedback summary")
        raise Exception(
            "Error parsing AI feedback summary"
        )  # figure out what exception to throw here


# TODO: make corresponding feature flag and function for user feedback summaries
# def spam_detection_enabled(project: Project) -> bool:
#     return features.has(
#         "organizations:user-feedback-spam-ingest", project.organization
#     ) and project.get_option("sentry:feedback_ai_spam_detection")
