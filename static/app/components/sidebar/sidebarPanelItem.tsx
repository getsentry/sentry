import styled from '@emotion/styled';

import space from 'sentry/styles/space';

import {t} from '../../locale';
import ExternalLink from '../links/externalLink';

type Props = {
  children?: React.ReactNode;
  cta?: string;
  hasSeen?: boolean;
  link?: string;
  message?: React.ReactNode;
  title?: string;
};

const SidebarPanelItem = ({hasSeen, title, message, link, cta, children}: Props) => (
  <SidebarPanelItemRoot>
    {title && <Title hasSeen={hasSeen}>{title}</Title>}
    {message && <Message>{message}</Message>}

    {children}

    {link && (
      <Text>
        <ExternalLink href={link}>{cta || t('Read More')}</ExternalLink>
      </Text>
    )}
  </SidebarPanelItemRoot>
);

export default SidebarPanelItem;

const SidebarPanelItemRoot = styled('div')`
  line-height: 1.5;
  border-top: 1px solid ${p => p.theme.innerBorder};
  background: ${p => p.theme.background};
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(3)};
`;

const Title = styled('div')<Pick<Props, 'hasSeen'>>`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(1)};
  color: ${p => p.theme.textColor};
  ${p => !p.hasSeen && 'font-weight: 600;'};

  .culprit {
    font-weight: normal;
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
