import type {Dispatch, SetStateAction} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import ConnectedMonitorsList, {
  MONITORS_PER_PAGE,
} from 'sentry/views/automations/components/connectedMonitorsList';
import {makeDetectorListQueryKey, useDetectorsQuery} from 'sentry/views/detectors/hooks';

interface Props {
  connectedIds: Set<string>;
  setConnectedIds: Dispatch<SetStateAction<Set<string>>>;
}

export default function EditConnectedMonitors({connectedIds, setConnectedIds}: Props) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const organization = useOrganization();

  const connectedDetectorsQueryResults = useDetectorsQuery(
    {
      ids: Array.from(connectedIds),
      limit: MONITORS_PER_PAGE,
      cursor:
        typeof location.query.cursor === 'string' ? location.query.cursor : undefined,
    },
    {enabled: connectedIds.size > 0}
  );

  const allDetectorsQueryResults = useDetectorsQuery({
    limit: MONITORS_PER_PAGE,
    cursor: typeof location.query.cursor === 'string' ? location.query.cursor : undefined,
  });

  const connectedDetectors = connectedDetectorsQueryResults.data;

  const toggleConnected = (detector: Detector) => {
    const newSet = new Set(connectedIds);
    if (newSet.has(detector.id)) {
      newSet.delete(detector.id);

      // Remove the detector from the cache
      setApiQueryData<Detector[]>(
        queryClient,
        makeDetectorListQueryKey({
          orgSlug: organization.slug,
          ids: Array.from(newSet),
          limit: MONITORS_PER_PAGE,
          cursor:
            typeof location.query.cursor === 'string' ? location.query.cursor : undefined,
        }),
        () => {
          const result = connectedDetectors?.filter(d => d.id !== detector.id) || [];
          return result;
        }
      );
    } else {
      newSet.add(detector.id);

      // Add the detector to the cache
      setApiQueryData<Detector[]>(
        queryClient,
        makeDetectorListQueryKey({
          orgSlug: organization.slug,
          ids: Array.from(newSet),
          limit: MONITORS_PER_PAGE,
          cursor:
            typeof location.query.cursor === 'string' ? location.query.cursor : undefined,
        }),
        () => {
          const result = connectedDetectors || [];
          result.push(detector);
          return result;
        }
      );
    }
    setConnectedIds(newSet);
  };

  return (
    <div>
      {connectedIds.size > 0 && (
        <Fragment>
          <Heading>{t('Connected Monitors')}</Heading>
          <ConnectedMonitorsList
            detectorCount={connectedIds.size}
            detectorQueryResults={connectedDetectorsQueryResults}
            connectedDetectorIds={connectedIds}
            toggleConnected={toggleConnected}
          />
        </Fragment>
      )}
      <Heading>
        {/* TODO: Filter out connected monitors */}
        {t('All Monitors')}
      </Heading>
      <div style={{flexGrow: 1}}>
        <StyledInputGroup>
          <InputGroup.LeadingItems disablePointerEvents>
            <IconSearch color="subText" size="sm" />
          </InputGroup.LeadingItems>
          <InputGroup.Input
            placeholder={t('Search for a monitor or project')}
            type="text"
            autoComplete="off"
          />
        </StyledInputGroup>
      </div>
      <ConnectedMonitorsList
        detectorCount={undefined}
        detectorQueryResults={allDetectorsQueryResults}
        connectedDetectorIds={connectedIds}
        toggleConnected={toggleConnected}
      />
    </div>
  );
}

const Heading = styled('h2')`
  font-size: ${p => p.theme.fontSize.xl};
  margin-bottom: ${space(1.5)};
`;

const StyledInputGroup = styled(InputGroup)`
  margin-bottom: ${space(2)};
`;
