import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Input} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {IconClose} from 'sentry/icons';

import {type WorkflowEventDebugFormData} from 'admin/views/alertsDebug/types';

interface AlertDebugFormProps {
  workflowId: number;
  onBack?: () => void;
  onSubmit?: (data: WorkflowEventDebugFormData) => void;
}

export function AlertDebugForm({workflowId, onSubmit, onBack}: AlertDebugFormProps) {
  // Local state for the issue ID input (not the accumulated list)
  const [issueIdInput, setIssueIdInput] = useState('');

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      issueIds: [] as number[],
    },
    onSubmit: ({value}) => {
      if (value.issueIds.length === 0) {
        return;
      }

      onSubmit?.({
        workflowId,
        issueIds: value.issueIds,
      });
    },
  });

  const addIssueId = (e: React.MouseEvent) => {
    e.preventDefault();

    const id = parseInt(issueIdInput, 10);
    if (id > 0) {
      const current = form.getFieldValue('issueIds') ?? [];
      if (!current.includes(id)) {
        form.setFieldValue('issueIds', [...current, id]);
      }
      setIssueIdInput('');
    }
  };

  const removeIssueId = (idToRemove: number) => {
    const current = form.getFieldValue('issueIds') ?? [];

    form.setFieldValue(
      'issueIds',
      current.filter(id => id !== idToRemove)
    );
  };

  return (
    <form.AppForm>
      <form.FormWrapper>
        <Stack gap="lg">
          <Heading as="h2">Lookup Related Events</Heading>

          <form.AppField name="issueIds">
            {field => (
              <Stack gap="sm">
                <Text as="p">
                  This form takes a list of events, and will evaluate the fast conditions
                  to determine if the alert would pass.
                </Text>

                {field.state.value && field.state.value.length > 0 && (
                  <Stack gap="xs">
                    <Text bold>Selected Issue ID(s):</Text>
                    <Flex gap="xs" wrap="wrap">
                      {field.state.value.map(issueId => (
                        <Flex
                          key={issueId}
                          gap="xs"
                          align="center"
                          padding="xs sm"
                          background="secondary"
                          radius="sm"
                        >
                          <Text>{issueId}</Text>
                          <Button
                            size="xs"
                            priority="transparent"
                            icon={<IconClose size="xs" />}
                            aria-label={`Remove issue ${issueId}`}
                            onClick={() => removeIssueId(issueId)}
                          />
                        </Flex>
                      ))}
                    </Flex>
                  </Stack>
                )}

                <Flex gap="sm">
                  <Input
                    type="number"
                    placeholder="Issue ID"
                    value={issueIdInput}
                    onChange={e => setIssueIdInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addIssueId(e as unknown as React.MouseEvent);
                      }
                    }}
                  />
                  <Button onClick={addIssueId}>Add Issue</Button>
                </Flex>
                <field.Meta />

                <Text as="p">
                  <Text italic bold>
                    Note:&nbsp;
                  </Text>
                  Slow conditions do not evaluate, as they require state + time to
                  evaluate correctly.
                </Text>
              </Stack>
            )}
          </form.AppField>

          <Flex gap="md" justify="end">
            {onBack && <Button onClick={onBack}>Back</Button>}
            <form.SubmitButton>Evaluate Events</form.SubmitButton>
          </Flex>
        </Stack>
      </form.FormWrapper>
    </form.AppForm>
  );
}
