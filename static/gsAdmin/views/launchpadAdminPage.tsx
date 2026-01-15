import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Input} from 'sentry/components/core/input';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Heading, Text} from 'sentry/components/core/text';
import ConfigStore from 'sentry/stores/configStore';
import type {Region} from 'sentry/types/system';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

import {openAdminConfirmModal} from 'admin/components/adminConfirmationModal';
import PageHeader from 'admin/components/pageHeader';

function LaunchpadAdminPage() {
  const api = useApi();
  const [rerunArtifactId, setRerunArtifactId] = useState<string>('');
  const [deleteArtifactId, setDeleteArtifactId] = useState<string>('');
  const [fetchInfoArtifactId, setFetchInfoArtifactId] = useState<string>('');
  const [batchDeleteArtifactIds, setBatchDeleteArtifactIds] = useState<string>('');
  const [fetchedArtifactInfo, setFetchedArtifactInfo] = useState<any>(null);
  const regions = ConfigStore.get('regions');
  const [region, setRegion] = useState<Region | null>(regions[0] ?? null);

  const {mutate: rerunAnalysis} = useMutation({
    mutationFn: () => {
      return fetchMutation({
        url: `/internal/preprod-artifact/rerun-analysis/`,
        method: 'POST',
        data: {
          preprod_artifact_id: rerunArtifactId,
        },
        options: {
          host: region?.url,
        },
      });
    },
    onSuccess: () => {
      addSuccessMessage(
        `Analysis rerun initiated successfully for artifact: ${rerunArtifactId}`
      );
      setRerunArtifactId('');
    },
    onError: () => {
      addErrorMessage(`Failed to rerun analysis for artifact: ${rerunArtifactId}`);
    },
  });

  const {mutate: deleteArtifactData} = useMutation({
    mutationFn: () => {
      return fetchMutation({
        url: `/internal/preprod-artifact/batch-delete/`,
        method: 'DELETE',
        data: {
          preprod_artifact_ids: [deleteArtifactId],
        },
        options: {
          host: region?.url,
        },
      });
    },
    onSuccess: () => {
      addSuccessMessage(
        `All data deleted successfully for artifact: ${deleteArtifactId}`
      );
      setDeleteArtifactId('');
    },
    onError: () => {
      addErrorMessage(`Failed to delete data for artifact: ${deleteArtifactId}`);
    },
  });

  const fetchArtifactInfo = () => {
    if (!fetchInfoArtifactId) {
      addErrorMessage('Artifact ID is required');
      return;
    }
    if (!region) {
      addErrorMessage('Please select a region first');
      return;
    }

    api.request(`/internal/preprod-artifact/${fetchInfoArtifactId}/info/`, {
      method: 'GET',
      host: region?.url,
      success: (data: any) => {
        addSuccessMessage(
          `Artifact info fetched successfully for: ${fetchInfoArtifactId}`
        );
        setFetchedArtifactInfo(data);
        setFetchInfoArtifactId('');
      },
      error: () => {
        addErrorMessage(`Failed to fetch info for artifact: ${fetchInfoArtifactId}`);
      },
    });
  };

  const {mutate: batchDeleteArtifacts} = useMutation({
    mutationFn: () => {
      return fetchMutation({
        url: `/internal/preprod-artifact/batch-delete/`,
        method: 'DELETE',
        data: {
          preprod_artifact_ids: batchDeleteArtifactIds
            .split(',')
            .map(id => id.trim())
            .filter(id => id),
        },
        options: {
          host: region?.url,
        },
      });
    },
    onSuccess: () => {
      const artifactCount = batchDeleteArtifactIds
        .split(',')
        .filter(id => id.trim()).length;
      addSuccessMessage(`Successfully deleted ${artifactCount} artifacts`);
      setBatchDeleteArtifactIds('');
    },
    onError: () => {
      addErrorMessage(`Failed to batch delete artifacts`);
    },
  });

  const handleRerunSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!region) {
      addErrorMessage('Please select a region first');
      return;
    }
    rerunAnalysis();
  };

  const handleDeleteSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!region) {
      addErrorMessage('Please select a region first');
      return;
    }

    openAdminConfirmModal({
      header: <h4>Delete Artifact Data</h4>,
      modalSpecificContent: (
        <div>
          <p>
            <strong>
              Are you sure you want to delete ALL data for artifact "{deleteArtifactId}"?
            </strong>
          </p>
          <p>This will permanently delete:</p>
          <ul>
            <li>The artifact record</li>
            <li>All associated files</li>
            <li>All related metadata</li>
          </ul>
          <p>
            <strong>This action cannot be undone.</strong>
          </p>
        </div>
      ),
      confirmText: 'Delete All Data',
      onConfirm: () => {
        deleteArtifactData();
      },
    });
  };

  const handleFetchInfoSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    fetchArtifactInfo();
  };

  const handleBatchDeleteSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!region) {
      addErrorMessage('Please select a region first');
      return;
    }

    const artifactIds = batchDeleteArtifactIds
      .split(',')
      .map(id => id.trim())
      .filter(id => id);
    const artifactCount = artifactIds.length;

    openAdminConfirmModal({
      header: <h4>Batch Delete Artifacts</h4>,
      modalSpecificContent: (
        <div>
          <p>
            <strong>
              Are you sure you want to delete ALL data for {artifactCount} artifact
              {artifactCount > 1 ? 's' : ''}?
            </strong>
          </p>
          <p>Artifact IDs: {artifactIds.join(', ')}</p>
          <p>This will permanently delete:</p>
          <ul>
            <li>All artifact records</li>
            <li>All associated files</li>
            <li>All related metadata</li>
          </ul>
          <p>
            <strong>This action cannot be undone.</strong>
          </p>
        </div>
      ),
      confirmText: `Delete ${artifactCount} Artifact${artifactCount > 1 ? 's' : ''}`,
      onConfirm: () => {
        batchDeleteArtifacts();
      },
    });
  };

  return (
    <div>
      <PageHeader title="Launchpad Admin Page" />
      <Flex direction="column" gap="lg">
        <Text as="p">
          This is a launchpad admin page for managing preprod artifacts. Provide the
          preprod artifact ID to perform the desired action.
        </Text>

        <CompactSelect
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix="Region" />
          )}
          value={region ? region.url : undefined}
          options={regions.map((r: any) => ({
            label: r.name,
            value: r.url,
          }))}
          onChange={opt => {
            const regionOption = regions.find((r: any) => r.url === opt.value);
            if (regionOption === undefined) {
              return;
            }
            setRegion(regionOption);
          }}
        />

        <Grid
          columns="1fr 1fr"
          gap="xl"
          css={css`
            @media (max-width: 768px) {
              grid-template-columns: 1fr;
            }
          `}
        >
          <form onSubmit={handleRerunSubmit}>
            <Container background="secondary" border="primary" radius="md" padding="lg">
              <Flex direction="column" gap="md">
                <Heading as="h3">Rerun Analysis</Heading>
                <Text as="p" variant="muted">
                  Rerun analysis for a specific preprod artifact.
                </Text>
                <label htmlFor="rerunArtifactId">
                  <Text bold>Preprod Artifact ID:</Text>
                </label>
                <StyledInput
                  type="text"
                  name="rerunArtifactId"
                  value={rerunArtifactId}
                  onChange={e => setRerunArtifactId(e.target.value)}
                  placeholder="Enter preprod artifact ID"
                />
                <Button
                  priority="primary"
                  type="submit"
                  disabled={!rerunArtifactId.trim() || !region}
                  css={css`
                    width: fit-content;
                  `}
                >
                  Rerun Analysis
                </Button>
              </Flex>
            </Container>
          </form>

          <form onSubmit={handleDeleteSubmit}>
            <Container background="secondary" border="primary" radius="md" padding="lg">
              <Flex direction="column" gap="md">
                <Heading as="h3">Delete Artifact Data</Heading>
                <Text as="p" variant="muted">
                  Delete all associated data for a specific preprod artifact.
                </Text>
                <label htmlFor="deleteArtifactId">
                  <Text bold>Preprod Artifact ID:</Text>
                </label>
                <StyledInput
                  type="text"
                  name="deleteArtifactId"
                  value={deleteArtifactId}
                  onChange={e => setDeleteArtifactId(e.target.value)}
                  placeholder="Enter preprod artifact ID"
                />
                <Button
                  priority="danger"
                  type="submit"
                  disabled={!deleteArtifactId.trim() || !region}
                  css={css`
                    width: fit-content;
                  `}
                >
                  Delete Data
                </Button>
              </Flex>
            </Container>
          </form>

          <form onSubmit={handleFetchInfoSubmit}>
            <Container background="secondary" border="primary" radius="md" padding="lg">
              <Flex direction="column" gap="md">
                <Heading as="h3">Fetch Artifact Info</Heading>
                <Text as="p" variant="muted">
                  Retrieve all data and details for a specific preprod artifact.
                </Text>
                <label htmlFor="fetchInfoArtifactId">
                  <Text bold>Preprod Artifact ID:</Text>
                </label>
                <StyledInput
                  type="text"
                  name="fetchInfoArtifactId"
                  value={fetchInfoArtifactId}
                  onChange={e => setFetchInfoArtifactId(e.target.value)}
                  placeholder="Enter preprod artifact ID"
                />
                <Button
                  priority="default"
                  type="submit"
                  disabled={!fetchInfoArtifactId.trim() || !region}
                  css={css`
                    width: fit-content;
                  `}
                >
                  Fetch Info
                </Button>
              </Flex>
            </Container>
          </form>

          <form onSubmit={handleBatchDeleteSubmit}>
            <Container background="secondary" border="primary" radius="md" padding="lg">
              <Flex direction="column" gap="md">
                <Heading as="h3">Batch Delete Artifacts</Heading>
                <Text as="p" variant="muted">
                  Delete multiple artifacts at once using comma-separated IDs.
                </Text>
                <label htmlFor="batchDeleteArtifactIds">
                  <Text bold>Preprod Artifact IDs (comma-separated):</Text>
                </label>
                <StyledInput
                  type="text"
                  name="batchDeleteArtifactIds"
                  value={batchDeleteArtifactIds}
                  onChange={e => setBatchDeleteArtifactIds(e.target.value)}
                  placeholder="e.g., 123, 456, 789"
                />
                <Button
                  priority="danger"
                  type="submit"
                  disabled={!batchDeleteArtifactIds.trim() || !region}
                  css={css`
                    width: fit-content;
                  `}
                >
                  Batch Delete
                </Button>
              </Flex>
            </Container>
          </form>
        </Grid>

        {fetchedArtifactInfo && (
          <Container background="secondary" border="primary" radius="md" padding="lg">
            <Flex direction="column" gap="md">
              {fetchedArtifactInfo.artifact_info?.project?.organization_slug &&
                fetchedArtifactInfo.artifact_info?.project?.slug &&
                fetchedArtifactInfo.artifact_info?.id && (
                  <Container
                    background="tertiary"
                    border="primary"
                    radius="sm"
                    padding="md"
                  >
                    <Flex direction="column" gap="xs">
                      <Text bold size="sm">
                        Artifact URL:
                      </Text>
                      <Link
                        to={`https://${fetchedArtifactInfo.artifact_info.project.organization_slug}.sentry.io/preprod/${fetchedArtifactInfo.artifact_info.project.slug}/${fetchedArtifactInfo.artifact_info.id}/`}
                      >
                        {`https://${fetchedArtifactInfo.artifact_info.project.organization_slug}.sentry.io/preprod/${fetchedArtifactInfo.artifact_info.project.slug}/${fetchedArtifactInfo.artifact_info.id}/`}
                      </Link>
                    </Flex>
                  </Container>
                )}
              <Heading as="h3">Fetched Artifact Information</Heading>
              <InfoDisplay>
                <pre>{JSON.stringify(fetchedArtifactInfo, null, 2)}</pre>
              </InfoDisplay>
              <Button priority="default" onClick={() => setFetchedArtifactInfo(null)}>
                Clear Info
              </Button>
            </Flex>
          </Container>
        )}
      </Flex>
    </div>
  );
}

const StyledInput = styled(Input)`
  width: 100%;
  max-width: 300px;
`;

const InfoDisplay = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.md};
  max-height: 400px;
  overflow-y: auto;

  pre {
    margin: 0;
    font-family: ${p => p.theme.text.familyMono};
    font-size: 12px;
    line-height: 1.4;
    color: ${p => p.theme.tokens.content.primary};
    white-space: pre-wrap;
    word-break: break-word;
  }
`;

export default LaunchpadAdminPage;
