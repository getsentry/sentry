import type {CSSProperties} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {Flex} from 'sentry/components/profiling/flex';
import TextOverflow from 'sentry/components/textOverflow';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

interface Props {
  feedbackItem: FeedbackIssue;
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

export default function FeedbackShortId({className, feedbackItem, style}: Props) {
  const organization = useOrganization();

  const feedbackUrl =
    window.location.origin +
    normalizeUrl(
      `/organizations/${organization.slug}/feedback/?feedbackSlug=${feedbackItem.project.slug}:${feedbackItem.id}&project=${feedbackItem.project.id}`
    );

  const {onClick: handleCopyUrl} = useCopyToClipboard({
    successMessage: t('Copied Feedback URL to clipboard'),
    text: feedbackUrl,
  });

  const {onClick: handleCopyShortId} = useCopyToClipboard({
    successMessage: t('Copied Short-ID to clipboard'),
    text: feedbackItem.shortId,
  });

  return (
    <Flex
      gap={space(1)}
      align="center"
      className={className}
      style={style}
      css={hideDropdown}
    >
      <Flex gap={space(0.75)} align="center">
        <ProjectAvatar
          project={feedbackItem.project}
          size={12}
          title={feedbackItem.project.slug}
        />
        <ShortId>{feedbackItem.shortId}</ShortId>
      </Flex>
      <DropdownMenu
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
            key: 'copy-url',
            label: t('Copy Feedback URL'),
            onAction: handleCopyUrl,
          },
          {
            key: 'copy-short-id',
            label: t('Copy Short-ID'),
            onAction: handleCopyShortId,
          },
        ]}
      />
    </Flex>
  );
}

const ShortId = styled(TextOverflow)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;
