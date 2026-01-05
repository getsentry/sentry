import {Fragment, useCallback, useId, type CSSProperties} from 'react';
import styled from '@emotion/styled';

import {AiPrivacyTooltip} from 'sentry/components/aiPrivacyTooltip';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import {IconMail} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {selectText} from 'sentry/utils/selectText';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  feedbackIssue: FeedbackIssue;
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackItemUsername({className, feedbackIssue, style}: Props) {
  const name = feedbackIssue.metadata.name;
  const email = feedbackIssue.metadata.contact_email;

  const organization = useOrganization();
  const {setupAcknowledgement, areAiFeaturesAllowed} = useOrganizationSeerSetup();
  const nameOrEmail = name || email;
  const isSameNameAndEmail = name === email;

  const user = name && email && !isSameNameAndEmail ? `${name} <${email}>` : nameOrEmail;

  const summary = feedbackIssue.metadata.summary;
  const isAiSummaryEnabled =
    areAiFeaturesAllowed &&
    setupAcknowledgement.orgHasAcknowledged &&
    organization.features.includes('user-feedback-ai-titles');

  const userNodeId = useId();

  const handleSelectText = useCallback(() => {
    const node = document.getElementById(userNodeId);
    if (!node) {
      return;
    }

    selectText(node);
  }, [userNodeId]);

  const {copy} = useCopyToClipboard();

  if (!name && !email) {
    return <strong>{t('Anonymous User')}</strong>;
  }

  const emailSubject =
    isAiSummaryEnabled && summary
      ? `Following up from ${organization.name}: ${summary}`
      : `Following up from ${organization.name}`;

  const mailToHref = `mailto:${email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(
    feedbackIssue.metadata.message
      .split('\n')
      .map(s => `> ${s}`)
      .join('\n')
  )}`;

  return (
    <Flex align="center" gap="md" className={className} style={style}>
      <Flex align="center" wrap="wrap" gap="xs">
        {isAiSummaryEnabled && summary && (
          <Fragment>
            <AiPrivacyTooltip>
              <strong>{summary}</strong>
            </AiPrivacyTooltip>
            <Purple>•</Purple>
          </Fragment>
        )}
        <Tooltip title={t('Click to copy')} containerDisplayMode="flex">
          <Flex
            id={userNodeId}
            align="center"
            wrap="wrap"
            gap="xs"
            onClick={() => {
              handleSelectText();
              copy(user ?? '');
            }}
          >
            {isSameNameAndEmail ? (
              <strong>{name ?? email}</strong>
            ) : (
              <Fragment>
                <strong>{name ?? t('No Name')}</strong>
                <Purple>•</Purple>
                <strong>{email ?? t('No Email')}</strong>
              </Fragment>
            )}
          </Flex>
        </Tooltip>
      </Flex>
      {email ? (
        <Tooltip title={t(`Email %s`, user)} containerDisplayMode="flex">
          <LinkButton
            href={mailToHref}
            external
            icon={<IconMail color="gray300" />}
            aria-label={t(`Email %s`, user)}
            borderless
            size="zero"
          />
        </Tooltip>
      ) : null}
    </Flex>
  );
}

const Purple = styled('span')`
  color: ${p => p.theme.colors.blue400};
`;
