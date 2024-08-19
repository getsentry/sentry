import styled from '@emotion/styled';

import Badge from 'sentry/components/badge/badge';
import {LinkButton} from 'sentry/components/button';
// import ExternalLink from 'sentry/components/links/externalLink';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  /**
   * Content rendered instead the panel item
   */
  children?: React.ReactNode;
  /**
   * The text for the CTA link at the bottom of the panel item
   */
  cta?: string;
  /**
   * Has the item been seen? affects the styling of the panel item
   */
  hasSeen?: boolean;
  /**
   * Image url
   */
  imageUrl?: string;
  /**
   * The URL to use for the CTA
   */
  link?: string;
  /**
   * A message with muted styling which appears above the children content
   */
  message?: React.ReactNode;
  /**
   * The title of the sidebar item
   */
  title?: string;
  /**
   * Actions to the right of the title
   */
  titleAction?: React.ReactNode;
};

function BroadcastPanelItem({
  hasSeen,
  title,
  message,
  link,
  cta,
  titleAction,
  imageUrl,
  children,
}: Props) {
  const organization = useOrganization();
  return (
    <SidebarPanelItemRoot>
      {title && (
        <TitleWrapper>
          <Title hasSeen={hasSeen}>{title}</Title>
          {titleAction}
          {true /* !hasSeen */ ? <Badge type={'new'}>new</Badge> : null}
        </TitleWrapper>
      )}
      {children}

      {imageUrl && (
        <img
          src={imageUrl}
          alt={title}
          style={{maxWidth: '100%', marginBottom: space(1)}}
        />
      )}

      {message && <Message>{message}</Message>}

      {link && (
        <Text>
          <LinkButton
            external
            href={link}
            onClick={() =>
              trackAnalytics('whats_new.link_clicked', {organization, title})
            }
            style={{marginTop: space(1)}}
          >
            {cta || t('Read More')}
          </LinkButton>
        </Text>
      )}
    </SidebarPanelItemRoot>
  );
}

export default BroadcastPanelItem;

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

const Title = styled('div')<Pick<Props, 'hasSeen'>>`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(1)};
  color: ${p => p.theme.textColor};
  font-weight: ${p => p.theme.fontWeightBold};

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
