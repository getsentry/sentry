import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Container, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

export function MonitorCleanupTrigger({host}: {host?: string}) {
  const [organizationId, setOrganizationId] = useState('');
  const {mutate, isPending, data, isError} = useMutation({
    mutationFn: () =>
      fetchMutation<{runId: string; url: string}>({
        url: getApiUrl('/internal/seer/monitor-cleanup/trigger/'),
        method: 'POST',
        data: {organizationId: Number(organizationId)},
        options: {host},
      }),
  });
  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        mutate();
      }}
    >
      <Container background="secondary" border="primary" radius="md" padding="lg">
        <Stack gap="md" align="start">
          <Heading as="h3">Find Duplicate Monitors</Heading>
          <Text>
            Scan an organization’s metric monitors with Seer. Findings are read-only;
            deletion is not available in this demo.
          </Text>
          <Text as="label" htmlFor="monitor-cleanup-org" bold>
            Organization ID
          </Text>
          <Input
            id="monitor-cleanup-org"
            type="text"
            inputMode="numeric"
            value={organizationId}
            onChange={event => setOrganizationId(event.target.value)}
          />
          <Button
            variant="primary"
            type="submit"
            busy={isPending}
            disabled={!host || !/^[1-9]\d*$/.test(organizationId)}
          >
            Find duplicate monitors
          </Button>
          {isError && (
            <Text variant="danger">
              Could not start the scan. Check that the organization has monitor cleanup
              enabled and that you have project access.
            </Text>
          )}
          {data && <LinkButton href={data.url}>View scan {data.runId}</LinkButton>}
        </Stack>
      </Container>
    </form>
  );
}
