import {useState} from 'react';

import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {Radio} from 'sentry/components/core/radio';

import PageHeader from 'admin/components/pageHeader';

// eslint-disable-next-line
const TimeInput = () => (
  <div style={{display: 'flex', gap: 4, width: '100%'}}>
    <div style={{flex: '1'}}>
      Start
      <Input name="start_time" type="time" placeholder="Start" />
    </div>

    <div style={{flex: '1'}}>
      End
      <Input name="end_time" type="time" placeholder="End" />
    </div>
  </div>
);

enum AlertDebugSelectionType {
  ISSUE_ID = 'Issue ID',
  TIME_RANGE = 'Time Range',
}

interface AlertDebugFormData {
  workflowId: number;
  issueId?: number;
}

// eslint-disable-next-line
const AlertDebugForm = ({onSubmit}: {onSubmit?: (data: AlertDebugFormData) => void}) => {
  const [selectedInputType, setInputType] = useState<AlertDebugSelectionType>(
    AlertDebugSelectionType.ISSUE_ID
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const data: AlertDebugFormData = {
      workflowId: Number(formData.get('workflowId')),
      issueId: Number(formData.get('issueId')),
    };

    if (onSubmit) {
      onSubmit(data);
    }
  };

  return (
    <form
      style={{display: 'flex', flexDirection: 'column', gap: 18}}
      onSubmit={handleSubmit}
    >
      <Input name="workflowId" type="number" placeholder="Alert ID" required />

      <div style={{display: 'flex', gap: 8, flexDirection: 'column'}}>
        <strong>Select input type:</strong>
        <fieldset>
          {Object.entries(AlertDebugSelectionType).map(entry => (
            <label key={entry[0]} style={{display: 'flex', gap: 4, alignItems: 'center'}}>
              <Radio
                name={entry[0]}
                value={entry[0]}
                checked={entry[1] === selectedInputType}
                onChange={() => setInputType(entry[1])}
              />
              {entry[1]}
            </label>
          ))}
        </fieldset>
      </div>

      {selectedInputType === AlertDebugSelectionType.ISSUE_ID && (
        <Input name="issueId" type="number" placeholder="Issue ID" />
      )}
      {selectedInputType === AlertDebugSelectionType.TIME_RANGE && <TimeInput />}

      <Button priority="primary" type="submit">
        Evalue Alert
      </Button>
    </form>
  );
};

function AlertsDebug() {
  const updateApi = (data: AlertDebugFormData) => {
    // TODO --  send execution to server here
    console.log({data});
  };

  return (
    <div>
      <PageHeader title="Alerts Debug" />

      <AlertDebugForm onSubmit={updateApi} />
      <div>{/* show the detector evaluation results */}</div>
    </div>
  );
}

export default AlertsDebug;
