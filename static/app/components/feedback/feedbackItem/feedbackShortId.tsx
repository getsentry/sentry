import type {CSSProperties} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import queryString from 'query-string';

import {Flex} from 'sentry/components/container/flex';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import useCurrentFeedbackProject from 'sentry/components/feedback/useCurrentFeedbackProject';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import TextOverflow from 'sentry/components/textOverflow';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';

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
  button[aria-haspopup]:focus-visible {
    opacity: 1;
  }
`;

export default function FeedbackShortId({className, feedbackItem, style}: Props) {
  const organization = useOrganization();
  const projectSlug = useCurrentFeedbackProject();

  // we need the stringifyUrl part so that the whole item is a string
  // for the copy url button below. normalizeUrl can return an object if `query`
  // or other options are passed, which breaks the copy-paste.
  const feedbackUrl =
    window.location.origin +
    normalizeUrl(`/organizations/${organization.slug}/feedback/`) +
    queryString.stringifyUrl({
      url: '?',
      query: {
        feedbackSlug: `${projectSlug}:${feedbackItem.id}`,
        project: feedbackItem.project?.id,
      },
    });

  const {onClick: handleCopyUrl} = useCopyToClipboard({
    successMessage: t('Copied Feedback URL to clipboard'),
    text: feedbackUrl,
  });

  const {onClick: handleCopyShortId} = useCopyToClipboard({
    successMessage: t('Copied Short-ID to clipboard'),
    text: feedbackItem.shortId,
  });

  const {onClick: handleCopyMarkdown} = useCopyToClipboard({
    text: `[${feedbackItem.shortId}](${feedbackUrl})`,
    successMessage: t('Copied Markdown Feedback Link to clipboard'),
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
        {feedbackItem.project ? (
          <ProjectBadge
            project={feedbackItem.project}
            avatarSize={16}
            hideName
            avatarProps={{hasTooltip: true, tooltip: feedbackItem.project.slug}}
          />
        ) : null}
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
          {
            key: 'copy-markdown-link',
            label: t('Copy Markdown Link'),
            onAction: handleCopyMarkdown,
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
