import {useRef, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Heading, Text} from '@sentry/scraps/text';

import {TimeInput} from 'admin/views/alertsDebug/components/timeInput';
import {
  AlertDebugSelectionType,
  type AlertDebugFormData,
} from 'admin/views/alertsDebug/types';

interface AlertDebugFormProps {
  workflowId: number;
  onSubmit?: (data: AlertDebugFormData) => void;
}

export function AlertDebugForm({workflowId, onSubmit}: AlertDebugFormProps) {
  const issueIdInputRef = useRef<HTMLInputElement>(null);
  const [selectedInputType, setInputType] = useState<AlertDebugSelectionType>(
    AlertDebugSelectionType.ISSUE_ID
  );
  const [issueIds, setIssueIds] = useState<number[]>([]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const data: AlertDebugFormData = {workflowId};
    const formData = new FormData(e.currentTarget);

    switch (selectedInputType) {
      case AlertDebugSelectionType.ISSUE_ID:
        data.issueIds = issueIds;
        break;
      case AlertDebugSelectionType.TIME_RANGE: {
        const startDate = formData.get('start_date') as string;
        const startTime = formData.get('start_time') as string;
        const endDate = formData.get('end_date') as string;
        const endTime = formData.get('end_time') as string;
        data.dateRange = {
          start: new Date(`${startDate} ${startTime}`),
          end: new Date(`${endDate} ${endTime}`),
        };
        break;
      }
      default:
        throw new Error(`Unknown Replay Type ${selectedInputType}`);
    }

    onSubmit?.(data);
  };

  const addId = (e: React.MouseEvent) => {
    e.preventDefault();
    if (issueIdInputRef.current) {
      const issueId = Number(issueIdInputRef.current.value);
      setIssueIds([...issueIds, issueId]);
      issueIdInputRef.current.value = '';
    }
  };

  const updateInputType = (inputType: AlertDebugSelectionType) => {
    setInputType(inputType);
    setIssueIds([]);
    if (issueIdInputRef.current) {
      issueIdInputRef.current.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg">
        <Input name="workflowId" type="hidden" required />

        <Stack gap="sm">
          <Heading as="h3">Alert Replay</Heading>
          <fieldset>
            <Stack gap="sm">
              {Object.entries(AlertDebugSelectionType).map(([key, value]) => (
                <Flex as="label" key={key} gap="xs" align="center">
                  <Radio
                    name={key}
                    value={key}
                    checked={value === selectedInputType}
                    onChange={() => updateInputType(value)}
                  />
                  <Text>{value}</Text>
                </Flex>
              ))}
            </Stack>
          </fieldset>
        </Stack>

        {selectedInputType === AlertDebugSelectionType.ISSUE_ID && (
          <Stack gap="sm">
            {issueIds.length > 0 && (
              <Stack gap="sm">
                <Text as="p">
                  This evaluation will take a list of Issue IDs then replay each, in
                  order.
                </Text>
                <Text bold>Selected Issue ID(s):</Text>
                <Stack as="ul" gap="xs">
                  {issueIds.map(issueId => (
                    <li key={issueId}>
                      <Text>{issueId}</Text>
                    </li>
                  ))}
                </Stack>
              </Stack>
            )}

            <Flex gap="sm">
              <Input
                name="issueId"
                type="number"
                placeholder="Issue ID"
                ref={issueIdInputRef}
              />
              <Button onClick={addId}>Add Issue</Button>
            </Flex>
          </Stack>
        )}

        {selectedInputType === AlertDebugSelectionType.TIME_RANGE && <TimeInput />}

        <Button priority="primary" type="submit">
          Execute Alert Evaluation
        </Button>
      </Stack>
    </form>
  );
}
