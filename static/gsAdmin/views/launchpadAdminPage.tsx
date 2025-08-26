import {useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Input} from 'sentry/components/core/input';
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
        options: {},
      });
    },
    onSuccess: () => {
      addSuccessMessage(`Analysis rerun initiated successfully for artifact: ${rerunArtifactId}`);
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
        options: {},
      });
    },
    onSuccess: () => {
      addSuccessMessage(`All data deleted successfully for artifact: ${deleteArtifactId}`);
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

    api.request(`/internal/preprod-artifact/${fetchInfoArtifactId}/info/`, {
      method: 'GET',
      success: (data: any) => {
        addSuccessMessage(`Artifact info fetched successfully for: ${fetchInfoArtifactId}`);
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
          preprod_artifact_ids: batchDeleteArtifactIds.split(',').map(id => id.trim()).filter(id => id),
        },
        options: {},
      });
    },
    onSuccess: () => {
      const artifactCount = batchDeleteArtifactIds.split(',').filter(id => id.trim()).length;
      addSuccessMessage(`Successfully deleted ${artifactCount} artifacts`);
      setBatchDeleteArtifactIds('');
    },
    onError: () => {
      addErrorMessage(`Failed to batch delete artifacts`);
    },
  });

  const handleRerunSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    rerunAnalysis();
  };

  const handleDeleteSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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
          <p><strong>This action cannot be undone.</strong></p>
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

    const artifactIds = batchDeleteArtifactIds.split(',').map(id => id.trim()).filter(id => id);
    const artifactCount = artifactIds.length;

    openAdminConfirmModal({
      header: <h4>Batch Delete Artifacts</h4>,
      modalSpecificContent: (
        <div>
          <p>
            <strong>
              Are you sure you want to delete ALL data for {artifactCount} artifact{artifactCount > 1 ? 's' : ''}?
            </strong>
          </p>
          <p>Artifact IDs: {artifactIds.join(', ')}</p>
          <p>This will permanently delete:</p>
          <ul>
            <li>All artifact records</li>
            <li>All associated files</li>
            <li>All related metadata</li>
          </ul>
          <p><strong>This action cannot be undone.</strong></p>
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
      <Container>
        <p>
          This is a launchpad admin page for managing preprod artifacts.
          Provide the preprod artifact ID to perform the desired action.
        </p>

        <CompactSelect
          triggerProps={{prefix: 'Region'}}
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

        <FormsContainer>
          <FormSection onSubmit={handleRerunSubmit}>
            <h3>Rerun Analysis</h3>
            <p>Rerun analysis for a specific preprod artifact.</p>
            <label htmlFor="rerunArtifactId">Preprod Artifact ID:</label>
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
              disabled={!rerunArtifactId.trim()}
            >
              Rerun Analysis
            </Button>
          </FormSection>

          <FormSection onSubmit={handleDeleteSubmit}>
            <h3>Delete Artifact Data</h3>
            <p>Delete all associated data for a specific preprod artifact.</p>
            <label htmlFor="deleteArtifactId">Preprod Artifact ID:</label>
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
              disabled={!deleteArtifactId.trim()}
            >
              Delete Data
            </Button>
          </FormSection>

          <FormSection onSubmit={handleFetchInfoSubmit}>
            <h3>Fetch Artifact Info</h3>
            <p>Retrieve all data and details for a specific preprod artifact.</p>
            <label htmlFor="fetchInfoArtifactId">Preprod Artifact ID:</label>
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
              disabled={!fetchInfoArtifactId.trim()}
            >
              Fetch Info
            </Button>
          </FormSection>

          <FormSection onSubmit={handleBatchDeleteSubmit}>
            <h3>Batch Delete Artifacts</h3>
            <p>Delete multiple artifacts at once using comma-separated IDs.</p>
            <label htmlFor="batchDeleteArtifactIds">Preprod Artifact IDs (comma-separated):</label>
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
              disabled={!batchDeleteArtifactIds.trim()}
            >
              Batch Delete
            </Button>
          </FormSection>
        </FormsContainer>

        {fetchedArtifactInfo && (
          <InfoDisplayContainer>
            <h3>Fetched Artifact Information</h3>
            <InfoDisplay>
              <pre>{JSON.stringify(fetchedArtifactInfo, null, 2)}</pre>
            </InfoDisplay>
            <Button
              priority="default"
              onClick={() => setFetchedArtifactInfo(null)}
            >
              Clear Info
            </Button>
          </InfoDisplayContainer>
        )}
      </Container>
    </div>
  );
}

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.lg};

  > * {
    margin: 0;
  }
`;

const FormsContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${p => p.theme.space.xl};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FormSection = styled('form')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.lg};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.backgroundSecondary};

  h3 {
    margin: 0;
    color: ${p => p.theme.headingColor};
  }

  p {
    margin: 0;
    color: ${p => p.theme.subText};
  }

  label {
    font-weight: 600;
    color: ${p => p.theme.textColor};
  }

  button {
    width: fit-content;
  }
`;

const StyledInput = styled(Input)`
  width: 100%;
  max-width: 300px;
`;

const InfoDisplayContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.lg};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.backgroundSecondary};

  h3 {
    margin: 0;
    color: ${p => p.theme.headingColor};
  }

  button {
    width: fit-content;
  }
`;

const InfoDisplay = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space.md};
  max-height: 400px;
  overflow-y: auto;

  pre {
    margin: 0;
    font-family: ${p => p.theme.text.familyMono};
    font-size: 12px;
    line-height: 1.4;
    color: ${p => p.theme.textColor};
    white-space: pre-wrap;
    word-break: break-word;
  }
`;

export default LaunchpadAdminPage;
