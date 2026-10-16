import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Stack} from '@sentry/scraps/layout';

import {Hovercard} from 'sentry/components/hovercard';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
import {tn} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {useAutomationListDetectors} from 'sentry/views/automations/hooks/useAutomationListDetectors';
import {DetectorLink} from 'sentry/views/detectors/components/detectorLink';

type AutomationListConnectedDetectorsProps = {
  detectorIds: string[];
};

const MAX_DISPLAYED_DETECTORS = 5;

function ConnectedDetectorsBody({detectorIds}: {detectorIds: string[]}) {
  const {detectorsById, isLoading, isError} = useAutomationListDetectors();
  const shownIds = detectorIds.slice(0, MAX_DISPLAYED_DETECTORS);
  const hasMore = detectorIds.length > MAX_DISPLAYED_DETECTORS;

  if (isError) {
    return <LoadingError />;
  }

  if (isLoading) {
    return (
      <div>
        {Array.from({length: shownIds.length}).map((_, index) => (
          <Stack padding="md xl" gap="xs" minHeight="64px" key={index}>
            <Placeholder height="20px" width="100%" />
            <Placeholder height="18px" width="70%" />
          </Stack>
        ))}
      </div>
    );
  }

  const detectors = shownIds.map(id => detectorsById.get(id)).filter(defined);

  return (
    <div>
      {detectors.map(detector => {
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
  gap: ${p => p.theme.space.xs};
`;

const HovercardRow = styled('div')`
  position: relative;
  display: flex;
  justify-content: center;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  min-height: 64px;

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const MoreText = styled('p')`
  color: ${p => p.theme.tokens.content.secondary};
  text-align: center;
  margin: 0;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
`;
