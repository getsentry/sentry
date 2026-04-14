import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ConfigStore} from 'sentry/stores/configStore';
import type {Region} from 'sentry/types/system';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';

import {PageHeader} from 'admin/components/pageHeader';

export function SeerAdminPage() {
  const [organizationId, setOrganizationId] = useState<string>('');
  const regions = ConfigStore.get('regions');
  const [region, setRegion] = useState<Region | null>(regions[0] ?? null);

  const {mutate: triggerNightShift, isPending: isNightShiftPending} = useMutation({
    mutationFn: () => {
      return fetchMutation({
        url: '/internal/seer/night-shift/trigger/',
        method: 'POST',
        data: {organization_id: parseInt(organizationId, 10)},
        options: {host: region?.url},
      });
    },
    onSuccess: () => {
      addSuccessMessage(`Night shift run triggered for organization ${organizationId}`);
      setOrganizationId('');
    },
    onError: () => {
      addErrorMessage('Failed to trigger night shift run');
    },
  });

  const handleNightShiftSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!region) {
      addErrorMessage('Please select a region first');
      return;
    }
    if (!organizationId.trim()) {
      addErrorMessage('Organization ID is required');
      return;
    }
    triggerNightShift();
  };

  return (
    <div>
      <PageHeader title="Seer Admin Page" />
      <Flex direction="column" gap="lg">
        <Text as="p">
          Admin tools for managing Seer features. Select a region before performing
          actions.
        </Text>

        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix="Region" />
          )}
          value={region ? region.url : undefined}
          options={regions.map((r: Region) => ({
            label: r.name,
            value: r.url,
          }))}
          onChange={opt => {
            const regionOption = regions.find((r: Region) => r.url === opt.value);
            if (regionOption === undefined) {
              return;
            }
            setRegion(regionOption);
          }}
        />

        <Grid columns={{xs: '1fr', md: '1fr 1fr'}} gap="xl">
          <form onSubmit={handleNightShiftSubmit}>
            <Container background="secondary" border="primary" radius="md" padding="lg">
              <Flex direction="column" gap="md" align="start">
                <Heading as="h3">Trigger Night Shift Run</Heading>
                <Text as="p" variant="muted">
                  Dispatch a night shift run for a specific organization. This will select
                  candidate issues and run agentic triage on them.
                </Text>
                <label htmlFor="organizationId">
                  <Text bold>Organization ID:</Text>
                </label>
                <Input
                  type="text"
                  name="organizationId"
                  value={organizationId}
                  onChange={e => setOrganizationId(e.target.value)}
                  placeholder="Enter organization ID"
                />
                <Button
                  priority="primary"
                  type="submit"
                  disabled={!organizationId.trim() || !region || isNightShiftPending}
                >
                  Trigger Night Shift
                </Button>
              </Flex>
            </Container>
          </form>
        </Grid>
      </Flex>
    </div>
  );
}
