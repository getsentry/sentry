import {ActionFixture, DataConditionFixture} from 'sentry-fixture/automations';
import {MetricDetectorFixture} from 'sentry-fixture/detectors';

import {ActionType} from 'sentry/types/workflowEngine/actions';
import {
  DataConditionGroupLogicType,
  DataConditionType,
  type DataConditionGroup,
} from 'sentry/types/workflowEngine/dataConditions';
import {
  getIncompatibleActionWarnings,
  getPartialTriggerSupportMessage,
} from 'sentry/views/automations/utils/getIncompatibleActionWarning';

const ACTIONS_WITH_ACTIVITY_HANDLER = [
  ActionType.EMAIL,
  ActionType.SLACK,
  ActionType.SLACK_STAGING,
  ActionType.MSTEAMS,
  ActionType.DISCORD,
  ActionType.SENTRY_APP,
  ActionType.WEBHOOK,
];

const ACTIONS_WITHOUT_ACTIVITY_HANDLER = [
  ActionType.PAGERDUTY,
  ActionType.OPSGENIE,
  ActionType.GITHUB,
  ActionType.GITHUB_ENTERPRISE,
  ActionType.JIRA,
  ActionType.JIRA_SERVER,
  ActionType.AZURE_DEVOPS,
  ActionType.PLUGIN,
];

const DEFAULT_TRIGGERS = [
  DataConditionType.FIRST_SEEN_EVENT,
  DataConditionType.ISSUE_RESOLVED_TRIGGER,
  DataConditionType.REAPPEARED_EVENT,
  DataConditionType.REGRESSION_EVENT,
];

const EVENT_TRIGGERS = [
  DataConditionType.FIRST_SEEN_EVENT,
  DataConditionType.REAPPEARED_EVENT,
  DataConditionType.REGRESSION_EVENT,
  DataConditionType.EVERY_EVENT,
  DataConditionType.NEW_HIGH_PRIORITY_ISSUE,
  DataConditionType.EXISTING_HIGH_PRIORITY_ISSUE,
];

const RESOLVED_WARNING = 'This action will not fire when an issue is resolved.';
const SEER_WARNING = 'This action is not supported for Seer activity triggers.';
const METRIC_WARNING = 'This action will not fire for metric issues.';
const PARTIAL_SUPPORT_MESSAGE =
  'This action will fire for your other triggers, but not when an issue is resolved.';

function triggerGroup(
  types: DataConditionType[],
  logicType = DataConditionGroupLogicType.ANY_SHORT_CIRCUIT
): DataConditionGroup {
  return {
    id: 'triggers',
    conditions: types.map((type, index) =>
      DataConditionFixture({id: `condition-${index}`, type, comparison: true})
    ),
    logicType,
  };
}

describe('getIncompatibleActionWarning', () => {
  it('accounts for every action type', () => {
    expect(
      new Set([...ACTIONS_WITH_ACTIVITY_HANDLER, ...ACTIONS_WITHOUT_ACTIVITY_HANDLER])
    ).toEqual(new Set(Object.values(ActionType)));
  });

  describe('getPartialTriggerSupportMessage', () => {
    it.each(ACTIONS_WITHOUT_ACTIVITY_HANDLER)(
      'returns a message for %s on the default triggers',
      type => {
        expect(
          getPartialTriggerSupportMessage(
            ActionFixture({type}),
            triggerGroup(DEFAULT_TRIGGERS)
          )
        ).toBe(PARTIAL_SUPPORT_MESSAGE);
      }
    );

    it.each(ACTIONS_WITH_ACTIVITY_HANDLER)(
      'returns null for %s on the default triggers',
      type => {
        expect(
          getPartialTriggerSupportMessage(
            ActionFixture({type}),
            triggerGroup(DEFAULT_TRIGGERS)
          )
        ).toBeNull();
      }
    );

    it.each(EVENT_TRIGGERS)('returns a message when paired with %s', eventTrigger => {
      expect(
        getPartialTriggerSupportMessage(
          ActionFixture({type: ActionType.JIRA}),
          triggerGroup([DataConditionType.ISSUE_RESOLVED_TRIGGER, eventTrigger])
        )
      ).toBe(PARTIAL_SUPPORT_MESSAGE);
    });

    it.each([
      DataConditionGroupLogicType.ANY,
      DataConditionGroupLogicType.ANY_SHORT_CIRCUIT,
    ])('returns a message with %s logic', logicType => {
      expect(
        getPartialTriggerSupportMessage(
          ActionFixture({type: ActionType.JIRA}),
          triggerGroup(DEFAULT_TRIGGERS, logicType)
        )
      ).toBe(PARTIAL_SUPPORT_MESSAGE);
    });

    it('returns null when all logic requires the resolved trigger', () => {
      expect(
        getPartialTriggerSupportMessage(
          ActionFixture({type: ActionType.JIRA}),
          triggerGroup(DEFAULT_TRIGGERS, DataConditionGroupLogicType.ALL)
        )
      ).toBeNull();
    });

    it('returns null when the resolved trigger is not selected', () => {
      expect(
        getPartialTriggerSupportMessage(
          ActionFixture({type: ActionType.JIRA}),
          triggerGroup(EVENT_TRIGGERS)
        )
      ).toBeNull();
    });

    it('returns null when the resolved trigger is the only trigger', () => {
      expect(
        getPartialTriggerSupportMessage(
          ActionFixture({type: ActionType.JIRA}),
          triggerGroup([DataConditionType.ISSUE_RESOLVED_TRIGGER])
        )
      ).toBeNull();
    });

    it('returns null when a Seer trigger already rules out the action', () => {
      expect(
        getPartialTriggerSupportMessage(
          ActionFixture({type: ActionType.JIRA}),
          triggerGroup([...DEFAULT_TRIGGERS, DataConditionType.SEER_ACTIVITY_TRIGGER])
        )
      ).toBeNull();
    });

    it('returns null when there are no triggers', () => {
      expect(
        getPartialTriggerSupportMessage(
          ActionFixture({type: ActionType.JIRA}),
          triggerGroup([])
        )
      ).toBeNull();
    });
  });

  describe('getIncompatibleActionWarnings', () => {
    it.each(ACTIONS_WITHOUT_ACTIVITY_HANDLER)(
      'warns for %s when the resolved trigger is the only trigger',
      type => {
        expect(
          getIncompatibleActionWarnings(ActionFixture({type}), {
            connectedDetectors: [],
            triggers: triggerGroup([DataConditionType.ISSUE_RESOLVED_TRIGGER]),
          })
        ).toEqual([RESOLVED_WARNING]);
      }
    );

    it.each(ACTIONS_WITH_ACTIVITY_HANDLER)(
      'does not warn for %s when the resolved trigger is the only trigger',
      type => {
        expect(
          getIncompatibleActionWarnings(ActionFixture({type}), {
            connectedDetectors: [],
            triggers: triggerGroup([DataConditionType.ISSUE_RESOLVED_TRIGGER]),
          })
        ).toEqual([]);
      }
    );

    it.each(ACTIONS_WITHOUT_ACTIVITY_HANDLER)(
      'does not warn for %s on the default triggers',
      type => {
        expect(
          getIncompatibleActionWarnings(ActionFixture({type}), {
            connectedDetectors: [],
            triggers: triggerGroup(DEFAULT_TRIGGERS),
          })
        ).toEqual([]);
      }
    );

    it('warns when all logic requires the resolved trigger', () => {
      expect(
        getIncompatibleActionWarnings(ActionFixture({type: ActionType.JIRA}), {
          connectedDetectors: [],
          triggers: triggerGroup(DEFAULT_TRIGGERS, DataConditionGroupLogicType.ALL),
        })
      ).toEqual([RESOLVED_WARNING]);
    });

    it('warns about Seer and resolved when no event trigger is selected', () => {
      expect(
        getIncompatibleActionWarnings(ActionFixture({type: ActionType.JIRA}), {
          connectedDetectors: [],
          triggers: triggerGroup([
            DataConditionType.ISSUE_RESOLVED_TRIGGER,
            DataConditionType.SEER_ACTIVITY_TRIGGER,
          ]),
        })
      ).toEqual([SEER_WARNING, RESOLVED_WARNING]);
    });

    it('only warns about Seer when an event trigger is also selected', () => {
      expect(
        getIncompatibleActionWarnings(ActionFixture({type: ActionType.JIRA}), {
          connectedDetectors: [],
          triggers: triggerGroup([
            ...DEFAULT_TRIGGERS,
            DataConditionType.SEER_ACTIVITY_TRIGGER,
          ]),
        })
      ).toEqual([SEER_WARNING]);
    });

    it('warns about ticketing actions on metric monitors', () => {
      expect(
        getIncompatibleActionWarnings(ActionFixture({type: ActionType.JIRA}), {
          connectedDetectors: [MetricDetectorFixture()],
          triggers: triggerGroup(DEFAULT_TRIGGERS),
        })
      ).toEqual([METRIC_WARNING]);
    });

    it('does not warn about paging actions on metric monitors', () => {
      expect(
        getIncompatibleActionWarnings(ActionFixture({type: ActionType.PAGERDUTY}), {
          connectedDetectors: [MetricDetectorFixture()],
          triggers: triggerGroup(DEFAULT_TRIGGERS),
        })
      ).toEqual([]);
    });
  });

  it.each(ACTIONS_WITHOUT_ACTIVITY_HANDLER)(
    'reports the skipped resolved trigger exactly once for %s',
    type => {
      const triggerSets = [
        [DataConditionType.ISSUE_RESOLVED_TRIGGER],
        ...EVENT_TRIGGERS.map(eventTrigger => [
          DataConditionType.ISSUE_RESOLVED_TRIGGER,
          eventTrigger,
        ]),
        DEFAULT_TRIGGERS,
      ];

      for (const logicType of Object.values(DataConditionGroupLogicType)) {
        for (const triggerSet of triggerSets) {
          const triggers = triggerGroup(triggerSet, logicType);
          const action = ActionFixture({type});

          const warned = getIncompatibleActionWarnings(action, {
            connectedDetectors: [],
            triggers,
          }).includes(RESOLVED_WARNING);
          const noted = getPartialTriggerSupportMessage(action, triggers) !== null;

          expect(warned).not.toBe(noted);
        }
      }
    }
  );
});
