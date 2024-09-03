import {useCallback} from 'react';
import styled from '@emotion/styled';

import Badge from 'sentry/components/badge/badge';
import {LinkButton} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Broadcast} from 'sentry/types/system';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

interface BroadcastPanelItemProps
  extends Pick<
    Broadcast,
    'hasSeen' | 'category' | 'title' | 'message' | 'cta' | 'link' | 'mediaUrl'
  > {}

export function BroadcastPanelItem({
  hasSeen,
  title,
  message,
  link,
  cta,
  mediaUrl,
  category,
}: Pick<
  Broadcast,
  'hasSeen' | 'category' | 'title' | 'message' | 'cta' | 'link' | 'mediaUrl'
>) {
  const organization = useOrganization();

  const handlePanelClicked = useCallback(() => {
    trackAnalytics('whats_new.link_clicked', {organization, title, category});
  }, [organization, title, category]);

  return (
    <SidebarPanelItemRoot>
      <TitleWrapper>
        <Title hasSeen={hasSeen}>{title}</Title>
        <Badge type={!hasSeen ? 'new' : undefined}>{category}</Badge>
      </TitleWrapper>

      {mediaUrl && (
        <Image
          mediaUrl={mediaUrl}
          link={link}
          title={title}
          onClick={handlePanelClicked}
        />
      )}

      {message && <Message>{message}</Message>}

      {link && (
        <CTA>
          <LinkButton
            external
            href={link}
            onClick={handlePanelClicked}
            style={{marginTop: space(1)}}
          >
            {cta ?? t('Read More')}
          </LinkButton>
        </CTA>
      )}
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
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(3)};

  :not(:first-child) {
    border-top: 1px solid ${p => p.theme.innerBorder};
  }
`;

const TitleWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
`;

const Title = styled('div')<Pick<BroadcastPanelItemProps, 'hasSeen'>>`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(1)};
  color: ${p => p.theme.textColor};
  font-weight: ${p => p.theme.fontWeightBold};

  .culprit {
    font-weight: ${p => p.theme.fontWeightNormal};
  }
`;

const CTA = styled('div')`
  margin: ${space(0.5)} 0;

  &:last-child {
    margin-bottom: 0;
  }
`;

const Message = styled(CTA)`
  color: ${p => p.theme.subText};
`;
