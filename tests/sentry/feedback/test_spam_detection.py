from sentry.feedback.usecases.spam_detection import make_input_prompt


def test_make_input_prompt_case_insensitive():
    msg = "Hello WorlD! vEjh3476@@$AB@!"
    prompt1 = make_input_prompt(msg)
    prompt2 = make_input_prompt(msg.lower())

    assert prompt1 == prompt2
