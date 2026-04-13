import {useMemo} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {Hovercard} from 'sentry/components/hovercard';
import {LoadingError} from 'sentry/components/loadingError';
import {Placeholder} from 'sentry/components/placeholder';
import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
import {tn} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AutomationActionSummary} from 'sentry/views/automations/components/automationActionSummary';
import {automationsApiOptions} from 'sentry/views/automations/hooks';
import {getAutomationActions} from 'sentry/views/automations/hooks/utils';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';
import {useIssueStreamDetectorsForProject} from 'sentry/views/detectors/utils/useIssueStreamDetectorsForProject';

type DetectorListConnectedAutomationsProps = {
  automationIds: string[];
  projectId: string;
};

function ConnectedAutomationsHoverBody({automationIds}: {automationIds: string[]}) {
  const organization = useOrganization();
  const shownAutomations = automationIds.slice(0, 5);
  const {data, isPending, isError} = useQuery(
    automationsApiOptions(organization, {
      ids: automationIds.slice(0, 5),
    })
  );
  const hasMore = automationIds.length > 5;
  const hasMoreText = hasMore ? (
    <MoreText>{tn('%s more', '%s more', automationIds.length - 5)}</MoreText>
  ) : null;

  if (isError) {
    return <LoadingError />;
  }

  if (isPending) {
    return (
      <div>
        {Array.from({length: shownAutomations.length}).map((_, index) => (
          <Stack justify="center" padding="md xl" gap="xs" minHeight="64px" key={index}>
            <Placeholder height="20px" width="100%" />
            <Placeholder height="18px" width="40%" />
          </Stack>
        ))}
        {hasMoreText}
      </div>
    );
  }

  return (
    <div>
      {data?.map(automation => {
        const actions = getAutomationActions(automation);

        return (
          <HovercardRow
            key={automation.id}
            to={makeAutomationDetailsPathname(organization.slug, automation.id)}
          >
            <InteractionStateLayer />
            <div>
              <strong>{automation.name || '—'}</strong>
              <AutomationActionWrapper>
                <AutomationActionSummary actions={actions} hasTooltip={false} />
              </AutomationActionWrapper>
            </div>
          </HovercardRow>
        );
      })}
      {hasMoreText}
    </div>
  );
}

export function DetectorListConnectedAutomations({
  automationIds,
  projectId,
}: DetectorListConnectedAutomationsProps) {
  const {data: issueStreamDetectors, isPending} =
    useIssueStreamDetectorsForProject(projectId);

  // Combine the automation IDs from the project's issue stream detector with the directly-connected ones
  const combinedAutomationIds = useMemo(() => {
    if (isPending) {
      return automationIds;
    }
    const issueStreamAutomationIds = issueStreamDetectors?.[0]?.workflowIds ?? [];
    return [...new Set([...automationIds, ...issueStreamAutomationIds])];
  }, [automationIds, issueStreamDetectors, isPending]);

  if (isPending) {
    return <Placeholder height="20px" />;
  }

  if (!combinedAutomationIds.length) {
    return <EmptyCell />;
  }

  return (
    <ConnectedAutomations>
      <ClassNames>
        {({css}) => (
          <Hovercard
            body={<ConnectedAutomationsHoverBody automationIds={combinedAutomationIds} />}
            bodyClassName={css`
              padding: 0;
            `}
            showUnderline
          >
            {tn('%s alert', '%s alerts', combinedAutomationIds.length)}
          </Hovercard>
        )}
      </ClassNames>
    </ConnectedAutomations>
  );
}

const ConnectedAutomations = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.xs};
`;

const HovercardRow = styled(Link)`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  color: ${p => p.theme.tokens.content.primary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};

  min-height: 64px;

  &:first-child {
    border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
  }

  &:last-child {
    border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
  }

  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }

  &:hover strong {
    text-decoration: underline;
  }
`;

const AutomationActionWrapper = styled('div')`
  margin-top: ${p => p.theme.space.xs};
  color: ${p => p.theme.tokens.content.secondary};
`;

const MoreText = styled('p')`
  color: ${p => p.theme.tokens.content.secondary};
  text-align: center;
  margin: 0;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
`;
