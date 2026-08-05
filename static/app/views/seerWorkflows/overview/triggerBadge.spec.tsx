import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  mapRunSourceToTrigger,
  TriggerBadge,
} from 'sentry/views/seerWorkflows/overview/triggerBadge';

describe('mapRunSourceToTrigger', () => {
  it.each(['autofix', 'slack_thread', 'chat'])(
    'maps %s to the manual trigger',
    source => {
      expect(mapRunSourceToTrigger(source)).toBe('manual');
    }
  );

  it('maps night_shift to the workflow trigger', () => {
    expect(mapRunSourceToTrigger('night_shift')).toBe('night_shift');
  });

  it.each(['bug_fixer', 'dashboard_generate', null])(
    'leaves an unmapped source (%s) unclassified',
    source => {
      expect(mapRunSourceToTrigger(source)).toBeNull();
    }
  );
});

describe('TriggerBadge', () => {
  it('renders the mapped trigger label', () => {
    render(<TriggerBadge trigger="night_shift" />);
    expect(screen.getByText('Workflow')).toBeInTheDocument();
  });

  it('falls back to the raw source verbatim when the trigger is unmapped', () => {
    render(<TriggerBadge trigger={null} rawSource="bug_fixer" />);
    expect(screen.getByText('bug_fixer')).toBeInTheDocument();
  });

  it('renders nothing when neither a trigger nor a raw source is known', () => {
    const {container} = render(<TriggerBadge trigger={null} rawSource={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
