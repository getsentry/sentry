import React from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Clipboard from 'sentry/components/clipboard';
import ExternalLink from 'sentry/components/links/externalLink';
import Tooltip from 'sentry/components/tooltip';
import {CONFIG_DOCS_URL} from 'sentry/constants';
import {IconCopy, IconMail} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';

type InviteMembersButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

function InviteMembersButton({disabled, onClick}: InviteMembersButtonProps) {
  const action = (
    <Button
      priority="primary"
      size="small"
      onClick={onClick}
      data-test-id="email-invite"
      icon={<IconMail />}
      disabled={disabled}
    >
      {t('Invite Members')}
    </Button>
  );

  return disabled ? (
    <DisabledInviteMembersTooltip>{action}</DisabledInviteMembersTooltip>
  ) : (
    action
  );
}

const installText = (features: string[], featureName: string): string =>
  `# ${t('Enables the %s feature', featureName)}\n${features
    .map(f => `SENTRY_FEATURES['${f}'] = True`)
    .join('\n')}`;

type DisabledInviteMembersTooltipProps = {
  children: React.ReactNode;
};

function DisabledInviteMembersTooltip({children}: DisabledInviteMembersTooltipProps) {
  const title = tct(
    `Enable this feature on your sentry installation by adding the
    following configuration into your [configFile:sentry.conf.py].
    See [configLink:the configuration documentation] for more
    details.`,
    {
      configFile: <code />,
      configLink: <ExternalLink href={CONFIG_DOCS_URL} />,
    }
  );

  return (
    <Tooltip title={title} isHoverable>
      <TooltipClipboardWrapper>
        {children}

        <Clipboard
          value={installText(['organizations:invite-members'], 'Invite Members')}
        >
          <TooltipClipboardIconWrapper>
            <IconCopy size="xs" aria-label={t('Copy to clipboard')} />
          </TooltipClipboardIconWrapper>
        </Clipboard>
      </TooltipClipboardWrapper>
    </Tooltip>
  );
}

const TooltipClipboardWrapper = styled('div')`
  display: grid;
  grid-template-columns: auto max-content;
  align-items: center;
  gap: ${space(0.5)};
`;

const TooltipClipboardIconWrapper = styled('div')`
  pointer-events: auto;
  position: relative;
  bottom: -${space(0.25)};
  :hover {
    cursor: pointer;
  }
`;

export default InviteMembersButton;
