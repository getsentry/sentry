import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import color from 'color';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import type {useAiConfig} from 'sentry/views/issueDetails/streamline/hooks/useAiConfig';
import {useOpenSeerDrawer} from 'sentry/views/issueDetails/streamline/sidebar/seerDrawer';

interface Props {
  aiConfig: ReturnType<typeof useAiConfig>;
  event: Event;
  group: Group;
  hasStreamlinedUI: boolean;
  project: Project;
}

/**
 * CTA button for Explorer-based Seer section in the sidebar.
 *
 * Shows artifact previews and a button that indicates the current processing state.
 */
export function ExplorerSeerSectionCtaButton({
  aiConfig,
  event,
  group,
  project,
  hasStreamlinedUI,
}: Props) {
  const location = useLocation();
  const seerLink = {
    pathname: location.pathname,
    query: {
      ...location.query,
      seerDrawer: true,
    },
  };

  const openButtonRef = useRef<HTMLButtonElement>(null);
  const isDrawerOpenRef = useRef(false);

  const {runState, isLoading} = useExplorerAutofix(group.id);

  const {openSeerDrawer} = useOpenSeerDrawer({
    group,
    project,
    event,
    buttonRef: openButtonRef,
  });
  // Keep isDrawerOpenRef in sync with the Seer drawer state (based on URL query)
  useEffect(() => {
    isDrawerOpenRef.current = !!location.query.seerDrawer;
  }, [location.query.seerDrawer]);

  const isProcessing = runState?.status === 'processing';

  const handleOpenDrawer = () => {
    openSeerDrawer();
  };

  const showCtaButton =
    aiConfig.orgNeedsGenAiAcknowledgement ||
    aiConfig.hasAutofix ||
    (aiConfig.hasSummary && aiConfig.hasResources);

  const isButtonLoading = aiConfig.isAutofixSetupLoading || isLoading;

  const getButtonText = () => {
    if (!aiConfig.hasAutofix) {
      return t('Open Resources');
    }

    if (
      (aiConfig.orgNeedsGenAiAcknowledgement || !aiConfig.hasAutofixQuota) &&
      !aiConfig.isAutofixSetupLoading
    ) {
      return t('Fix with Seer');
    }

    if (!runState) {
      return t('Find Root Cause');
    }

    if (isProcessing) {
      return t('Working...');
    }

    if (runState.status === 'completed') {
      return t('Open Seer');
    }

    if (runState.status === 'error') {
      return t('View Error');
    }

    return t('Fix with Seer');
  };

  if (isButtonLoading) {
    return <ButtonPlaceholder />;
  }

  if (!showCtaButton) {
    return null;
  }

  return (
    <Container>
      <StyledButton
        to={seerLink}
        onClick={handleOpenDrawer}
        replace
        preventScrollReset
        analyticsEventKey="issue_details.seer_opened"
        analyticsEventName="Issue Details: Seer Opened"
        analyticsParams={{
          has_streamlined_ui: hasStreamlinedUI,
          autofix_exists: Boolean(runState),
          autofix_status: runState?.status ?? null,
        }}
        priority="primary"
      >
        {getButtonText()}
        <ChevronContainer>
          {isProcessing ? (
            <StyledLoadingIndicator size={14} />
          ) : (
            <IconChevron direction="right" size="xs" />
          )}
        </ChevronContainer>
      </StyledButton>
    </Container>
  );
}

const Container = styled('div')`
  display: flex;
  flex-direction: column;
`;

const StyledButton = styled(LinkButton)`
  margin-top: ${p => p.theme.space.md};
  width: 100%;
`;

const ChevronContainer = styled('div')`
  margin-left: ${p => p.theme.space.xs};
  height: 16px;
  width: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  position: relative;
  margin-left: ${p => p.theme.space.md};

  .loading-indicator {
    border-color: ${p => color(p.theme.button.primary.color).alpha(0.35).string()};
    border-left-color: ${p => p.theme.button.primary.color};
  }
`;

const ButtonPlaceholder = styled(Placeholder)`
  width: 100%;
  height: 38px;
  border-radius: ${p => p.theme.radius.md};
  margin-top: ${p => p.theme.space.md};
`;
