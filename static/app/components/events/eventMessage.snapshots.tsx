import {EventOrGroupType, type Level} from 'sentry/types/event';

import {EventMessage} from './eventMessage';

describe('EventMessage', () => {
  it.snapshot('with-level-and-message', () => (
    <div style={{padding: 8, width: 500}}>
      <EventMessage
        level="error"
        message="fetchData(app/components/group/suggestedOwners)"
        type={EventOrGroupType.ERROR}
      />
    </div>
  ));

  it.snapshot('no-message', () => (
    <div style={{padding: 8, width: 500}}>
      <EventMessage level="warning" message="" type={EventOrGroupType.ERROR} />
    </div>
  ));

  it.snapshot('unhandled', () => (
    <div style={{padding: 8, width: 500}}>
      <EventMessage
        level="error"
        message="TypeError: Cannot read properties of undefined"
        type={EventOrGroupType.ERROR}
        showUnhandled
      />
    </div>
  ));

  it.snapshot.each<Level>(['error', 'fatal', 'warning', 'info', 'sample', 'unknown'])(
    'level-%s',
    level => (
      <div style={{padding: 8, width: 500}}>
        <EventMessage
          level={level}
          message="Test message for level"
          type={EventOrGroupType.ERROR}
        />
      </div>
    ),
    level => ({tags: {area: 'core', level}})
  );
});
