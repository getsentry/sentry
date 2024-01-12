

def test_describe_event_with_none_frame(self):
    # Setup test event with exception containing frames, including None
    test_event = {
        'exception': {
            'values': [{
                'type': 'Error',
                'value': 'An error occurred',
                'stacktrace': {
                    'frames': [
                        {'filename': 'test1.py', 'function': 'test_func', 'lineno': 29, 'in_app': True},
                        None,
                        {'filename': 'test2.py', 'function': 'another_func', 'lineno': 45, 'in_app': False}
                    ]
                }
            }]
        }
    }

    # Call describe_event_for_ai
    event_info = describe_event_for_ai(test_event, model='gpt-3.5-turbo')

    # Verify that the None frame is skipped and 'first_in_app' logic is correct
    assert 'exceptions' in event_info
    exception_data = event_info['exceptions'][0]
    assert 'stacktrace' in exception_data
    stacktrace = exception_data['stacktrace']
    assert len(stacktrace) == 2  # None frame should be skipped
    assert stacktrace[0].get('crash') == 'here'  # First frame should have 'crash': 'here'
