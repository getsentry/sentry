import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

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
          <Stack padding="md xl" gap="xs" minHeight="64px" key={index}>
            <Placeholder height="20px" width="100%" />
            <Placeholder height="18px" width="70%" />
          </Stack>
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
            <DetectorLink detector={detector} />
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
          <WiderHovercard
            body={<ConnectedDetectorsBody detectorIds={detectorIds} />}
            bodyClassName={css`
              padding: 0;
              max-width: 600px;
            `}
            showUnderline
          >
            {tn('%s monitor', '%s monitors', detectorIds.length)}
          </WiderHovercard>
        )}
      </ClassNames>
    </ConnectedDetectors>
  );
}

const WiderHovercard = styled(Hovercard)`
  width: 360px;
`;

const ConnectedDetectors = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  flex-direction: row;
  gap: ${space(0.5)};
`;

const HovercardRow = styled('div')`
  position: relative;
  display: flex;
  justify-content: center;
  padding: ${space(1)} ${space(2)};
  min-height: 64px;

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const MoreText = styled('p')`
  color: ${p => p.theme.subText};
  text-align: center;
  margin: 0;
  padding: ${space(1)} ${space(2)};
`;
