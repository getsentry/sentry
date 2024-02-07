import type {CSSProperties} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {Flex} from 'sentry/components/profiling/flex';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

interface Props {
  detailDisplay: boolean;
  feedbackIssue: FeedbackIssue;
  className?: string;
  style?: CSSProperties;
}

const hideDropdown = css`
  button[aria-haspopup] {
    display: block;
    opacity: 0;
    transition: opacity 50ms linear;
  }

  &:hover button[aria-haspopup],
  button[aria-expanded='true'],
  button[aria-haspopup].focus-visible {
    opacity: 1;
  }
`;

export default function FeedbackItemUsername({
  className,
  detailDisplay,
  feedbackIssue,
  style,
}: Props) {
  const name = feedbackIssue.metadata.name;
  const email = feedbackIssue.metadata.contact_email;

  const {onClick: handleCopyEmail} = useCopyToClipboard({
    successMessage: t('Copied Email to clipboard'),
    text: String(email),
  });

  const {onClick: handleCopyUsername} = useCopyToClipboard({
    successMessage: t('Copied Name to clipboard'),
    text: String(name),
  });

  if (!email && !name) {
    return <strong>{t('Anonymous User')}</strong>;
  }

  if (detailDisplay) {
    return (
      <Flex
        align="center"
        gap={space(1)}
        className={className}
        style={style}
        css={hideDropdown}
      >
        <Flex align="center" wrap="wrap">
          <strong>
            {name ?? t('No Name')}
            <Purple>•</Purple>
          </strong>
          <strong>{email ?? t('No Email')}</strong>
        </Flex>
        <FlexDropdownMenu
          triggerProps={{
            'aria-label': t('Short-ID copy actions'),
            icon: <IconChevron direction="down" size="xs" />,
            size: 'zero',
            borderless: true,
            showChevron: false,
          }}
          position="bottom"
          size="xs"
          items={[
            {
              key: 'copy-email',
              label: t('Copy Email Address'),
              onAction: handleCopyEmail,
            },
            {
              key: 'copy-name',
              label: t('Copy Name'),
              onAction: handleCopyUsername,
            },
          ]}
        />
      </Flex>
    );
  }

  return <strong>{name ?? email}</strong>;
}

const FlexDropdownMenu = styled(DropdownMenu)`
  display: flex;
`;

const Purple = styled('span')`
  color: ${p => p.theme.purple300};
  padding: ${space(0.5)};
`;
