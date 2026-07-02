import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ContextCard} from 'sentry/components/events/contexts/contextCard';
import {
  getAccessibilityContextData,
  type AccessibilityContext,
} from 'sentry/components/events/contexts/knownContext/accessibility';

const MOCK_ACCESSIBILITY_CONTEXT: AccessibilityContext = {
  accessible_navigation: false,
  bold_text: false,
  disable_animations: true,
  high_contrast: false,
  invert_colors: false,
  reduce_motion: false,
  // Extra data is still valid and preserved
  extra_data: 'something',
  unknown_key: 123,
};

const MOCK_REDACTION = {
  reduce_motion: {
    '': {
      rem: [['organization:0', 's', 0, 0]],
      len: 5,
    },
  },
};

describe('AccessibilityContext', () => {
  it('returns values according to the parameters', () => {
    expect(getAccessibilityContextData({data: MOCK_ACCESSIBILITY_CONTEXT})).toEqual([
      {
        key: 'accessible_navigation',
        subject: 'Accessible Navigation',
        value: false,
      },
      {key: 'bold_text', subject: 'Bold Text', value: false},
      {key: 'disable_animations', subject: 'Disable Animations', value: true},
      {key: 'high_contrast', subject: 'High Contrast', value: false},
      {key: 'invert_colors', subject: 'Invert Colors', value: false},
      {key: 'reduce_motion', subject: 'Reduce Motion', value: false},
      {
        key: 'extra_data',
        subject: 'extra_data',
        value: 'something',
        meta: undefined,
      },
      {
        key: 'unknown_key',
        subject: 'unknown_key',
        value: 123,
        meta: undefined,
      },
    ]);
  });

  it('renders with meta annotations correctly', () => {
    const event = EventFixture({
      _meta: {contexts: {accessibility: MOCK_REDACTION}},
    });

    render(
      <ContextCard
        event={event}
        type="accessibility"
        alias="accessibility"
        value={{...MOCK_ACCESSIBILITY_CONTEXT, reduce_motion: ''}}
      />
    );

    expect(screen.getByText('Accessibility')).toBeInTheDocument();
    expect(screen.getByText('Disable Animations')).toBeInTheDocument();
    expect(screen.getByText('Reduce Motion')).toBeInTheDocument();
    expect(screen.getByText(/redacted/)).toBeInTheDocument();
  });
});
