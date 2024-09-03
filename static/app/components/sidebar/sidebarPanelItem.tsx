import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Broadcast} from 'sentry/types/system';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

interface SidebarPanelItemProps
  extends Partial<
    Pick<Broadcast, 'link' | 'category' | 'title' | 'hasSeen' | 'message'>
  > {
  /**
   * Content rendered instead the panel item
   */
  children?: React.ReactNode;
  ctaText?: string;
}

function SidebarPanelItem({
  hasSeen,
  title,
  message,
  link,
  ctaText,
  children,
}: SidebarPanelItemProps) {
  const organization = useOrganization();
  return (
    <SidebarPanelItemRoot>
      {title && <Title hasSeen={hasSeen}>{title}</Title>}
      {message && <Message>{message}</Message>}

      {children}

      {link && (
        <Text>
          <ExternalLink
            href={link}
            onClick={() => {
              if (!title) {
                return;
              }
              trackAnalytics('whats_new.link_clicked', {organization, title});
            }}
          >
            {ctaText || t('Read More')}
          </ExternalLink>
        </Text>
      )}
    </SidebarPanelItemRoot>
  );
}

export default SidebarPanelItem;

const SidebarPanelItemRoot = styled('div')`
  line-height: 1.5;
  background: ${p => p.theme.background};
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(3)};

  :not(:first-child) {
    border-top: 1px solid ${p => p.theme.innerBorder};
  }
`;

const Title = styled('div')<Pick<SidebarPanelItemProps, 'hasSeen'>>`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(1)};
  color: ${p => p.theme.textColor};
  ${p => !p.hasSeen && `font-weight: ${p.theme.fontWeightBold};`};

  .culprit {
    font-weight: ${p => p.theme.fontWeightNormal};
  }
`;

const Text = styled('div')`
  margin: ${space(0.5)} 0;

  &:last-child {
    margin-bottom: 0;
  }
`;

const Message = styled(Text)`
  color: ${p => p.theme.subText};
`;
