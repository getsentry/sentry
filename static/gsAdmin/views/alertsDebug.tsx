import {Fragment, useRef, useState} from 'react';

import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {Radio} from 'sentry/components/core/radio';
import {CodeBlock} from 'sentry/components/core/code/codeBlock';
import type {Automation} from 'sentry/types/workflowEngine/automations';

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
  const inputRef = useRef<HTMLInputElement>(null);
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
    const start = new Date(`${formData.get('start_date')} ${formData.get('start_time')}`);
    const end = new Date(`${formData.get('end_date')} ${formData.get('end_time')}`);

    if (issueIds.length) data.issueIds = issueIds;
    if (start && end) data.dateRange = {start, end};

    if (onSubmit) {
      onSubmit(data);
    }
  };

  const addId = (e: any) => {
    e.preventDefault();

    if (inputRef.current) {
      const issueId = Number(inputRef.current.value);
      setIssueIds([...issueIds, issueId]);
      inputRef.current.value = '';
    }
  };

  const updateInputType = (inputType: AlertDebugSelectionType) => {
    setInputType(inputType);

    // reset inputs
    setIssueIds([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <form
      style={{display: 'flex', flexDirection: 'column', gap: 18}}
      onSubmit={handleSubmit}
    >
      <Input name="workflowId" type="hidden" required />

      <div style={{display: 'flex', gap: 8, flexDirection: 'column'}}>
        <strong>Alert replay by:</strong>
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
            <Input name="issueId" type="number" placeholder="Issue ID" ref={inputRef} />
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

// eslint-disable-next-line
const AlertDetails = ({workflow}: {workflow: Automation}) => (
  <div>
    <h4>{workflow.name}</h4>

    {workflow.detectorIds.length && (
      <Fragment>
        <h6>Connected Monitors</h6>
        <CodeBlock language="javascript">
          {JSON.stringify(workflow)}
        </CodeBlock>
        <ul>
          {workflow.detectorIds.map(detectorId => (
            <li key={detectorId}>
              <a href="#">{detectorId}</a>
            </li>
          ))}
        </ul>
      </Fragment>
    )}
  </div>
);

const MOCK_WORKFLOW: Automation = {
  id: '1234',
  name: 'Mock Alert',
  createdBy: 'Josh',
  dateCreated: Date.now().toString(),
  dateUpdated: Date.now().toString(),
  lastTriggered: Date.now().toString(),
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
          <div style={{width: "100%", borderBottom: "1px solid #E0DCE5", margin: "64px 0"}} />
        </div>
      )}
      {workflowId && <AlertDebugForm onSubmit={updateApi} workflowId={workflowId} />}
      {results && <AlertDebugResults results={results} />}
    </div>
  );
}

export default AlertsDebug;
