import {useCallback} from 'react';
import styled from '@emotion/styled';

import Badge from 'sentry/components/badge/badge';
import {LinkButton} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {space} from 'sentry/styles/space';
import type {Broadcast} from 'sentry/types/system';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

interface BroadcastPanelItemProps
  extends Pick<
    Broadcast,
    'hasSeen' | 'category' | 'title' | 'message' | 'link' | 'mediaUrl'
  > {
  ctaText: string;
}

export function BroadcastPanelItem({
  hasSeen,
  title,
  message,
  link,
  ctaText,
  mediaUrl,
  category,
}: BroadcastPanelItemProps) {
  const organization = useOrganization();

  const handlePanelClicked = useCallback(() => {
    trackAnalytics('whats_new.link_clicked', {organization, title, category});
  }, [organization, title, category]);

  return (
    <SidebarPanelItemRoot>
      <TitleWrapper>
        <Title hasSeen={hasSeen}>{title}</Title>
        {category && <Badge type={!hasSeen ? 'new' : 'default'}>{category}</Badge>}
      </TitleWrapper>

      {mediaUrl && (
        <Image
          mediaUrl={mediaUrl}
          link={link}
          title={title}
          onClick={handlePanelClicked}
        />
      )}

      <Message>{message}</Message>

      <LinkButton
        external
        href={link}
        onClick={handlePanelClicked}
        style={{marginTop: space(1)}}
      >
        {ctaText}
      </LinkButton>
    </SidebarPanelItemRoot>
  );
}

function Image({
  mediaUrl,
  link,
  title,
  onClick,
}: Pick<BroadcastPanelItemProps, 'mediaUrl' | 'link' | 'title'> & {onClick: () => void}) {
  const image = (
    <img
      src={mediaUrl}
      alt={title}
      style={{maxWidth: '100%', marginBottom: space(1)}}
      onClick={onClick}
    />
  );

  if (link) {
    return <ExternalLink href={link}>{image}</ExternalLink>;
  }

  return image;
}

const SidebarPanelItemRoot = styled('div')`
  line-height: 1.5;
  background: ${p => p.theme.background};
  padding: ${space(3)};

  :not(:first-child) {
    border-top: 1px solid ${p => p.theme.innerBorder};
  }
`;

const TitleWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  margin-bottom: ${space(1)};
`;

const Title = styled('div')<Pick<BroadcastPanelItemProps, 'hasSeen'>>`
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.textColor};
  ${p => !p.hasSeen && `font-weight: ${p.theme.fontWeightBold}`};
`;

const Message = styled('div')`
  color: ${p => p.theme.subText};
`;
