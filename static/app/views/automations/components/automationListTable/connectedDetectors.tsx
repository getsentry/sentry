import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Hovercard} from 'sentry/components/hovercard';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
import {tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DetectorLink} from 'sentry/views/detectors/components/detectorLink';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks';

type AutomationListConnectedDetectorsProps = {
  detectorIds: string[];
};

const MAX_DISPLAYED_DETECTORS = 5;

function ConnectedDetectorsBody({detectorIds}: {detectorIds: string[]}) {
  const shownDetectors = detectorIds.slice(0, MAX_DISPLAYED_DETECTORS);
  const {data, isPending, isError} = useDetectorsQuery({
    ids: detectorIds.slice(0, MAX_DISPLAYED_DETECTORS),
  });
  const hasMore = detectorIds.length > MAX_DISPLAYED_DETECTORS;

  if (isError) {
    return <LoadingError />;
  }

  if (isPending) {
    return (
      <div>
        {Array.from({length: shownDetectors.length}).map((_, index) => (
          <HovercardSkeletonRow key={index}>
            <Placeholder height="20px" width="100%" />
            <Placeholder height="18px" width="70%" />
          </HovercardSkeletonRow>
        ))}
      </div>
    );
  }

  return (
    <div>
      {data?.map(detector => {
        return (
          <HovercardRow key={detector.id}>
            <InteractionStateLayer />
            <DetectorLink
              detectorId={detector.id}
              name={detector.name}
              createdBy={detector.createdBy}
              projectId={detector.projectId}
              disabled={detector.disabled}
            />
          </HovercardRow>
        );
      })}
      {hasMore && (
        <MoreText>
          {tn('%s more', '%s more', detectorIds.length - MAX_DISPLAYED_DETECTORS)}
        </MoreText>
      )}
    </div>
  );
}

export function AutomationListConnectedDetectors({
  detectorIds,
}: AutomationListConnectedDetectorsProps) {
  if (!detectorIds.length) {
    return <EmptyCell />;
  }

  return (
    <ConnectedDetectors>
      <ClassNames>
        {({css}) => (
          <Hovercard
            body={<ConnectedDetectorsBody detectorIds={detectorIds} />}
            bodyClassName={css`
              padding: 0;
            `}
            showUnderline
          >
            {tn('%s monitor', '%s monitors', detectorIds.length)}
          </Hovercard>
        )}
      </ClassNames>
    </ConnectedDetectors>
  );
}

const ConnectedDetectors = styled('div')`
  color: ${p => p.theme.textColor};
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};
`;

const HovercardSkeletonRow = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  padding: ${space(1)} ${space(2)};
  min-height: 64px;
`;

const HovercardRow = styled('div')`
  position: relative;
  display: flex;
  justify-content: center;
  padding: ${space(1)} ${space(2)};
  min-height: 64px;

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

const MoreText = styled('p')`
  color: ${p => p.theme.subText};
  text-align: center;
  margin: 0;
  padding: ${space(1)} ${space(2)};
`;
