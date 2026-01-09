import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Link} from 'sentry/components/core/link';
import {Hovercard} from 'sentry/components/hovercard';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
import {tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {AutomationActionSummary} from 'sentry/views/automations/components/automationActionSummary';
import {useAutomationsQuery} from 'sentry/views/automations/hooks';
import {getAutomationActions} from 'sentry/views/automations/hooks/utils';
import {makeAutomationDetailsPathname} from 'sentry/views/automations/pathnames';

type DetectorListConnectedAutomationsProps = {
  automationIds: string[];
};

function ConnectedAutomationsHoverBody({automationIds}: {automationIds: string[]}) {
  const organization = useOrganization();
  const shownAutomations = automationIds.slice(0, 5);
  const {data, isPending, isError} = useAutomationsQuery({
    ids: automationIds.slice(0, 5),
  });
  const hasMore = automationIds.length > 5;

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
      {hasMore && (
        <MoreText>{tn('%s more', '%s more', automationIds.length - 5)}</MoreText>
      )}
    </div>
  );
}

export function DetectorListConnectedAutomations({
  automationIds,
}: DetectorListConnectedAutomationsProps) {
  if (!automationIds.length) {
    return <EmptyCell />;
  }

  return (
    <ConnectedAutomations>
      <ClassNames>
        {({css}) => (
          <Hovercard
            body={<ConnectedAutomationsHoverBody automationIds={automationIds} />}
            bodyClassName={css`
              padding: 0;
            `}
            showUnderline
          >
            {tn('%s alert', '%s alerts', automationIds.length)}
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
  gap: ${space(0.5)};
`;

const HovercardRow = styled(Link)`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  color: ${p => p.theme.tokens.content.primary};
  padding: ${space(1)} ${space(2)};

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
  margin-top: ${space(0.5)};
  color: ${p => p.theme.subText};
`;

const MoreText = styled('p')`
  color: ${p => p.theme.subText};
  text-align: center;
  margin: 0;
  padding: ${space(1)} ${space(2)};
`;
