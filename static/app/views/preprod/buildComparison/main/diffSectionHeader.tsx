import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Heading} from '@sentry/scraps/text';

import {IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';

interface DiffSectionHeaderProps {
  /**
   * Unique identifier for the section, used for anchor links
   */
  id: string;
  /**
   * Title displayed in the section header
   */
  title: string;
  /**
   * Content to render to the right of the title
   */
  children?: React.ReactNode;
}

/**
 * Shared header component for diff sections with anchor link support.
 * Renders a separator, heading with copy-link button, and optional trailing content.
 */
export function DiffSectionHeader({id, title, children}: DiffSectionHeaderProps) {
  const handleAnchorClick = () => {
    const url = new URL(window.location.href);
    url.hash = id;
    window.history.replaceState(null, '', url.toString());
    navigator.clipboard.writeText(url.toString());
  };

  return (
    <Stack gap="xl">
      <Separator orientation="horizontal" border="primary" />
      <Flex align="center" justify="between" gap="md" id={id}>
        <TitleWrapper align="center" gap="sm">
          <Heading as="h2">{title}</Heading>
          <CopyLinkButton
            priority="transparent"
            size="xs"
            onClick={handleAnchorClick}
            aria-label={t('Copy link to %s', title)}
            title={t('Copy link')}
          >
            <IconLink size="xs" />
          </CopyLinkButton>
        </TitleWrapper>
        {children}
      </Flex>
    </Stack>
  );
}

const CopyLinkButton = styled(Button)`
  opacity: 0;
  transition: opacity 0.15s ease-in-out;
`;

const TitleWrapper = styled(Flex)`
  &:hover ${CopyLinkButton} {
    opacity: 1;
  }
`;
