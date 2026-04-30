import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {ConfigStore} from 'sentry/stores/configStore';
import type {Region} from 'sentry/types/system';
import {fetchMutation} from 'sentry/utils/queryClient';

import {PageHeader} from 'admin/components/pageHeader';

export function SeerAdminPage() {
  const [organizationId, setOrganizationId] = useState<string>('');
  const [dryRun, setDryRun] = useState<boolean>(false);
  const [maxCandidates, setMaxCandidates] = useState<string>('');
  const regions = ConfigStore.get('regions');
  const [region, setRegion] = useState<Region | null>(regions[0] ?? null);

  const {mutate: triggerNightShift, isPending: isNightShiftPending} = useMutation({
    mutationFn: () => {
      const trimmedOrgId = organizationId.trim();
      return fetchMutation({
        url: '/internal/seer/night-shift/trigger/',
        method: 'POST',
        data: {
          ...(trimmedOrgId ? {organization_id: parseInt(trimmedOrgId, 10)} : {}),
          dry_run: dryRun,
          ...(maxCandidates ? {max_candidates: parseInt(maxCandidates, 10)} : {}),
        },
        options: {host: region?.url},
      });
    },
    onSuccess: () => {
      const mode = dryRun ? ' (dry run)' : '';
      const target = organizationId.trim()
        ? `organization ${organizationId.trim()}`
        : 'all eligible orgs';
      addSuccessMessage(`Night shift run triggered for ${target}${mode}`);
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
    const trimmed = organizationId.trim();
    if (trimmed && !/^\d+$/.test(trimmed)) {
      addErrorMessage(
        'Organization ID must be a number (leave blank to trigger every org)'
      );
      return;
    }
    triggerNightShift();
  };

  const isFullSchedule = !organizationId.trim();

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
                  Dispatch a night shift run. Provide an organization ID to scope the run
                  to a single org, or leave it blank to trigger the full scheduler across
                  every eligible org in the selected region.
                </Text>
                <Alert.Container>
                  <Alert variant="warning">
                    Be careful — this dispatches real Celery tasks that call Seer and can
                    trigger autofix runs. Leaving the organization ID blank fans out to{' '}
                    <strong>every Seer-enabled org in the region</strong>, which will
                    incur Seer cost and worker load. Prefer dry run when iterating, and
                    don't fire repeatedly.
                  </Alert>
                </Alert.Container>
                <label htmlFor="organizationId">
                  <Text bold>Organization ID (blank = all orgs):</Text>
                </label>
                <Input
                  type="text"
                  name="organizationId"
                  value={organizationId}
                  onChange={e => setOrganizationId(e.target.value)}
                  placeholder="Leave blank to trigger every eligible org"
                />
                <label htmlFor="maxCandidates">
                  <Text bold>Max candidates (optional):</Text>
                </label>
                <Input
                  type="number"
                  name="maxCandidates"
                  min={1}
                  value={maxCandidates}
                  onChange={e => setMaxCandidates(e.target.value)}
                  placeholder="Leave blank to use default"
                />
                <Flex as="label" gap="sm" align="center">
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={e => setDryRun(e.target.checked)}
                  />
                  <Text>Dry run (triage only, no autofix triggered)</Text>
                </Flex>
                <Button
                  priority="primary"
                  type="submit"
                  disabled={!region || isNightShiftPending}
                >
                  {isFullSchedule
                    ? 'Trigger Night Shift (all orgs)'
                    : 'Trigger Night Shift'}
                </Button>
              </Flex>
            </Container>
          </form>
        </Grid>
      </Flex>
    </div>
  );
}
