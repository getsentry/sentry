import {Fragment, useRef, useState} from 'react';

import {Button} from 'sentry/components/core/button';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Input} from 'sentry/components/core/input';
import {Container} from 'sentry/components/core/layout/container';
import {Radio} from 'sentry/components/core/radio';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {
  DataCondition,
  DataConditionGroup,
} from 'sentry/types/workflowEngine/dataConditions';

import PageHeader from 'admin/components/pageHeader';

enum AlertDebugSelectionType {
  ISSUE_ID = 'Issue ID',
  TIME_RANGE = 'Date Range',
}

interface AlertDebugFormData {
  workflowId: number;
  dateRange?: {
    end: Date;
    start: Date;
  };
  issueIds?: number[];
}

// eslint-disable-next-line
const TimeInput = () => (
  <Fragment>
    <div>
      Start
      <div style={{display: 'flex', gap: 4, width: '100%'}}>
        <Input name="start_date" type="date" placeholder="Start Date" />
        <Input name="start_time" type="time" placeholder="Start" />
      </div>
    </div>

    <div>
      End
      <div style={{display: 'flex', gap: 4, width: '100%'}}>
        <Input name="end_date" type="date" placeholder="End Date" />
        <Input name="end_time" type="time" placeholder="End" />
      </div>
    </div>
  </Fragment>
);

// eslint-disable-next-line
const AlertDebugForm = ({
  workflowId, // TOOD -- pass in the workflow, not the workflow id
  onSubmit,
}: {
  workflowId: number;
  onSubmit?: (data: AlertDebugFormData) => void;
}) => {
  const issueIdInputRef = useRef<HTMLInputElement>(null);
  const [selectedInputType, setInputType] = useState<AlertDebugSelectionType>(
    AlertDebugSelectionType.ISSUE_ID
  );

  const [issueIds, setIssueIds] = useState<number[]>([]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const data: AlertDebugFormData = {
      workflowId,
    };

    const formData = new FormData(e.currentTarget);

    switch (selectedInputType) {
      case AlertDebugSelectionType.ISSUE_ID:
        data.issueIds = issueIds;
        break;
      case AlertDebugSelectionType.TIME_RANGE:
        data.dateRange = {
          start: new Date(`${formData.get('start_date')} ${formData.get('start_time')}`),
          end: new Date(`${formData.get('end_date')} ${formData.get('end_time')}`),
        };
        break;
      default:
        throw new Error(`Unknown Replay Type ${selectedInputType}`);
    }

    if (onSubmit) onSubmit(data);
  };

  const addId = (e: any) => {
    e.preventDefault();

    if (issueIdInputRef.current) {
      const issueId = Number(issueIdInputRef.current.value);
      setIssueIds([...issueIds, issueId]);
      issueIdInputRef.current.value = '';
    }
  };

  const updateInputType = (inputType: AlertDebugSelectionType) => {
    setInputType(inputType);

    // reset inputs
    setIssueIds([]);
    if (issueIdInputRef.current) issueIdInputRef.current.value = '';
  };

  return (
    <form
      style={{display: 'flex', flexDirection: 'column', gap: 18}}
      onSubmit={handleSubmit}
    >
      <Input name="workflowId" type="hidden" required />

      <div style={{display: 'flex', gap: 8, flexDirection: 'column'}}>
        <h3>Alert Replay</h3>
        <fieldset>
          {Object.entries(AlertDebugSelectionType).map(entry => (
            <label key={entry[0]} style={{display: 'flex', gap: 4, alignItems: 'center'}}>
              <Radio
                name={entry[0]}
                value={entry[0]}
                checked={entry[1] === selectedInputType}
                onChange={() => updateInputType(entry[1])}
              />
              {entry[1]}
            </label>
          ))}
        </fieldset>
      </div>

      {selectedInputType === AlertDebugSelectionType.ISSUE_ID && (
        <div>
          {issueIds.length > 0 && (
            <div>
              <strong>Selected Issue IDs:</strong>
              <ul>
                {issueIds.map(issueId => (
                  <li key={issueId}>{issueId}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{display: 'flex', gap: 8}}>
            <Input
              name="issueId"
              type="number"
              placeholder="Issue ID"
              ref={issueIdInputRef}
            />
            <Button onClick={addId}>Add Issue</Button>
          </div>
        </div>
      )}

      {selectedInputType === AlertDebugSelectionType.TIME_RANGE && <TimeInput />}

      <Button priority="primary" type="submit">
        Execute Alert Evaluation
      </Button>
    </form>
  );
};

// eslint-disable-next-line
const AlertDebugResults = ({results}: {results: any}) => (
  <div>
    Results!
    {JSON.stringify(results)}
  </div>
);

function AlertDataAttribute({dataKey, value}: {dataKey: string; value: any}) {
  if (typeof value === 'object') return null;

  let displayValue = value;

  switch (typeof value) {
    case 'boolean':
      displayValue = <Checkbox checked={value} disabled />;
      break;
    default:
      displayValue = value;
  }

  return (
    <div>
      <strong>{dataKey}:&nbsp;</strong>
      {displayValue}
    </div>
  );
}

// eslint-disable-next-line
const AlertCondition = ({condition}: {condition: DataCondition}) => (
  <div>{condition.id}</div>
);

// eslint-disable-next-line
const AlertConditionGroup = ({group}: {group: DataConditionGroup}) => (
  <Container>
    <div>{group.id}</div>

    {group.conditions && (
      <div>
        <strong>Condtions</strong>
        <ol>
          {group.conditions?.map(condition => (
            <li style={{margin: '16px 0'}} key={condition.id}>
              <AlertCondition condition={condition} />
            </li>
          ))}
        </ol>
      </div>
    )}

    {group.actions && (
      <div>
        <strong>Actions</strong>
        <ul>
          {group.actions?.map(action => (
            <Fragment key={action.id}>
              {/* TODO -- Make an action card? */}
              <div>{action.id}</div>
            </Fragment>
          ))}
        </ul>
      </div>
    )}
  </Container>
);

// eslint-disable-next-line
const AlertDetails = ({workflow}: {workflow: Automation}) => (
  <Fragment>
    <h1>{workflow.name}</h1>

    <div style={{marginBottom: 16}}>
      <h6>Settings</h6>
      <Container
        background="primary"
        padding="lg"
        radius="md"
        style={{border: '1px solid #E0DCE5'}}
      >
        {Object.entries(workflow).map(([key, value]) => (
          <div key={key} style={{margin: '8px 0'}}>
            <AlertDataAttribute dataKey={key} value={value} />
          </div>
        ))}
      </Container>
    </div>

    {workflow.detectorIds.length && (
      <div style={{flex: '1'}}>
        <h6>Connected Monitors</h6>
        <ul>
          {workflow.detectorIds.map(detectorId => (
            <li key={detectorId}>
              <a href="#">{detectorId}</a>
            </li>
          ))}
        </ul>
      </div>
    )}

    <div style={{display: 'flex'}}>
      <div style={{flex: '1'}}>
        <h6>Workflow Triggers</h6>
        {workflow.triggers && <AlertConditionGroup group={workflow.triggers} />}
        {!workflow.triggers && <span>None</span>}
      </div>

      {workflow.actionFilters && (
        <div style={{flex: '1'}}>
          <h6>Action Filters</h6>
          {workflow.actionFilters?.length === 0 && <span>None</span>}
          {workflow.actionFilters.map(actionFilter => (
            <AlertConditionGroup key={actionFilter.id} group={actionFilter} />
          ))}
        </div>
      )}
    </div>
  </Fragment>
);

const MOCK_WORKFLOW: Automation = {
  id: '1234',
  name: 'Mock Alert',
  createdBy: 'Josh',
  dateCreated: Date.now().toLocaleString(),
  dateUpdated: Date.now().toLocaleString(),
  lastTriggered: Date.now().toLocaleString(),
  config: {
    frequency: 10,
  },
  detectorIds: ['33', '732', '8'],
  enabled: true,
  environment: 'DEBUGGING -- TEST FIXTURE',
  actionFilters: [],
  triggers: null,
};

function AlertsDebug() {
  const [results, setResults] = useState<AlertDebugFormData>();
  const workflowRef = useRef<HTMLInputElement>(null);

  // TOOD make this be workflow and track with react query?
  const [workflowId, setWorkflowId] = useState<number>();
  const [workflow, setWorkflow] = useState<Automation>();

  const updateApi = (data: AlertDebugFormData) => {
    // todo - send data to server rather than UI
    setResults(data);
  };

  const getAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (workflowRef.current) {
      const currentWorkflowId = workflowRef.current.value;
      setWorkflowId(Number(currentWorkflowId));

      // TODO - update this to get data from the API in another component?
      setWorkflow({
        ...MOCK_WORKFLOW,
        id: currentWorkflowId,
      });
    }
  };

  return (
    <div>
      <PageHeader title="Alerts Debug" />

      <form onSubmit={getAlert}>
        <Input
          name="workflowId"
          type="number"
          placeholder="Alert ID"
          onBlur={getAlert}
          ref={workflowRef}
        />
      </form>

      {workflow && (
        <div style={{marginTop: 16}}>
          <AlertDetails workflow={workflow} />
          <div
            style={{width: '100%', borderBottom: '1px solid #E0DCE5', margin: '32px 0'}}
          />
          <h5>History</h5>
          <div
            style={{width: '100%', borderBottom: '1px solid #E0DCE5', margin: '32px 0'}}
          />
        </div>
      )}
      {workflowId && <AlertDebugForm onSubmit={updateApi} workflowId={workflowId} />}
      {results && <AlertDebugResults results={results} />}
    </div>
  );
}

export default AlertsDebug;
